using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using NLog;
using NzbDrone.Common.Disk;
using NzbDrone.Common.Extensions;
using NzbDrone.Common.Instrumentation.Extensions;
using NzbDrone.Core.Configuration;
using NzbDrone.Core.MediaFiles.Commands;
using NzbDrone.Core.MediaFiles.EpisodeImport;
using NzbDrone.Core.MediaFiles.Events;
using NzbDrone.Core.MediaFiles.MediaInfo;
using NzbDrone.Core.Messaging.Commands;
using NzbDrone.Core.Messaging.Events;
using NzbDrone.Core.RootFolders;
using NzbDrone.Core.Tv;

namespace NzbDrone.Core.MediaFiles
{
    public interface IDiskScanService
    {
        void Scan(Series series);
        string[] GetVideoFiles(string path, bool allDirectories = true);
        string[] GetNonVideoFiles(string path, bool allDirectories = true);
        List<string> FilterPaths(string basePath, IEnumerable<string> files, bool filterExtras = true);
    }

    public class DiskScanService :
        IDiskScanService,
        IExecute<RescanSeriesCommand>
    {
        private readonly IDiskProvider _diskProvider;
        private readonly IMakeImportDecision _importDecisionMaker;
        private readonly IImportApprovedEpisodes _importApprovedEpisodes;
        private readonly IConfigService _configService;
        private readonly ISeriesService _seriesService;
        private readonly IMediaFileService _mediaFileService;
        private readonly IMediaFileTableCleanupService _mediaFileTableCleanupService;
        private readonly IRootFolderService _rootFolderService;
        private readonly IUpdateMediaInfo _updateMediaInfoService;
        private readonly IFolderRoutingService _folderRoutingService;
        private readonly IManageCommandQueue _commandQueue;
        private readonly IEventAggregator _eventAggregator;
        private readonly Logger _logger;

        public DiskScanService(IDiskProvider diskProvider,
                               IMakeImportDecision importDecisionMaker,
                               IImportApprovedEpisodes importApprovedEpisodes,
                               IConfigService configService,
                               ISeriesService seriesService,
                               IMediaFileService mediaFileService,
                               IMediaFileTableCleanupService mediaFileTableCleanupService,
                               IRootFolderService rootFolderService,
                               IUpdateMediaInfo updateMediaInfoService,
                               IFolderRoutingService folderRoutingService,
                               IManageCommandQueue commandQueue,
                               IEventAggregator eventAggregator,
                               Logger logger)
        {
            _diskProvider = diskProvider;
            _importDecisionMaker = importDecisionMaker;
            _importApprovedEpisodes = importApprovedEpisodes;
            _configService = configService;
            _seriesService = seriesService;
            _mediaFileService = mediaFileService;
            _mediaFileTableCleanupService = mediaFileTableCleanupService;
            _rootFolderService = rootFolderService;
            _updateMediaInfoService = updateMediaInfoService;
            _folderRoutingService = folderRoutingService;
            _commandQueue = commandQueue;
            _eventAggregator = eventAggregator;
            _logger = logger;
        }

        private static readonly Regex ExcludedExtrasSubFolderRegex = new Regex(@"(?:\\|\/|^)(?:extras|extrafanart|behind the scenes|deleted scenes|featurettes|interviews|other|scenes|samples|shorts|trailers|theme[-_. ]music|backdrops)(?:\\|\/)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex ExcludedSubFoldersRegex = new Regex(@"(?:\\|\/|^)(?:@eadir|\.@__thumb|plex versions|\.[^\\/]+)(?:\\|\/)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex ExcludedExtraFilesRegex = new Regex(@"(-(trailer|other|behindthescenes|deleted|featurette|interview|scene|short)\.[^.]+$)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex ExcludedFilesRegex = new Regex(@"^\.(_|unmanic|DS_Store$)|^Thumbs\.db$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public void Scan(Series series)
        {
            var rootFolder = _rootFolderService.GetBestRootFolderPath(series.Path);

            var seriesFolderExists = _diskProvider.FolderExists(series.Path);

            if (!seriesFolderExists)
            {
                if (!_diskProvider.FolderExists(rootFolder))
                {
                    _logger.Warn("Series' root folder ({0}) doesn't exist.", rootFolder);
                    _eventAggregator.PublishEvent(new SeriesScanSkippedEvent(series, SeriesScanSkippedReason.RootFolderDoesNotExist));
                    return;
                }

                if (_diskProvider.FolderEmpty(rootFolder))
                {
                    _logger.Warn("Series' root folder ({0}) is empty.", rootFolder);
                    _eventAggregator.PublishEvent(new SeriesScanSkippedEvent(series, SeriesScanSkippedReason.RootFolderIsEmpty));
                    return;
                }
            }

            _logger.ProgressInfo("Scanning {0}", series.Title);

            if (!seriesFolderExists)
            {
                if (_configService.CreateEmptySeriesFolders)
                {
                    if (_configService.DeleteEmptyFolders)
                    {
                        _logger.Debug("Not creating missing series folder: {0} because delete empty series folders is enabled", series.Path);
                    }
                    else
                    {
                        _logger.Debug("Creating missing series folder: {0}", series.Path);

                        _diskProvider.CreateFolder(series.Path);
                        SetPermissions(series.Path);
                    }
                }
                else
                {
                    _logger.Debug("Series folder doesn't exist: {0}", series.Path);
                }

                CleanMediaFiles(series, new List<string>());
                CompletedScanning(series, new List<string>());

                return;
            }

            var videoFilesStopwatch = Stopwatch.StartNew();
            var mediaFileList = FilterPaths(series.Path, GetVideoFiles(series.Path)).ToList();
            videoFilesStopwatch.Stop();
            _logger.Trace("Finished getting episode files for: {0} [{1}]", series, videoFilesStopwatch.Elapsed);

            CleanMediaFiles(series, mediaFileList);

            var seriesFiles = _mediaFileService.GetFilesBySeries(series.Id);
            var unmappedFiles = MediaFileService.FilterExistingFiles(mediaFileList, seriesFiles, series);

            var decisionsStopwatch = Stopwatch.StartNew();
            var decisions = _importDecisionMaker.GetImportDecisions(unmappedFiles, series, false);
            decisionsStopwatch.Stop();
            _logger.Trace("Import decisions complete for: {0} [{1}]", series, decisionsStopwatch.Elapsed);
            _importApprovedEpisodes.Import(decisions, false);

            // Update existing files that have a different file size

            var fileInfoStopwatch = Stopwatch.StartNew();
            var filesToUpdate = new List<EpisodeFile>();
            var codecChangedFiles = new List<EpisodeFile>();

            foreach (var file in seriesFiles)
            {
                var path = Path.Combine(series.Path, file.RelativePath);
                var fileSize = _diskProvider.GetFileSize(path);

                if (file.Size == fileSize)
                {
                    continue;
                }

                var previousCodec = file.MediaInfo?.VideoFormat;

                file.Size = fileSize;

                if (!_updateMediaInfoService.Update(file, series))
                {
                    filesToUpdate.Add(file);
                }

                // Track files whose codec changed so we can re-evaluate routing.
                var newCodec = file.MediaInfo?.VideoFormat;
                if (newCodec.IsNotNullOrWhiteSpace() && newCodec != previousCodec)
                {
                    codecChangedFiles.Add(file);
                }
            }

            // Update any files that had a file size change, but didn't get media info updated.
            if (filesToUpdate.Any())
            {
                _mediaFileService.Update(filesToUpdate);
            }

            fileInfoStopwatch.Stop();
            _logger.Trace("Reprocessing existing files complete for: {0} [{1}]", series, decisionsStopwatch.Elapsed);

            // Only re-evaluate routing when a codec change was detected during this scan.
            // Running routing on every scan would override any path the user manually sets.
            if (codecChangedFiles.Any() && ApplyCodecRouting(series, codecChangedFiles))
            {
                // Series folder was moved — the queued rescan will continue from the new path.
                return;
            }

            RemoveEmptySeriesFolder(series.Path);

            var possibleExtraFiles = new List<string>();

            if (_diskProvider.FolderExists(series.Path))
            {
                var extraFiles = GetNonVideoFiles(series.Path);
                possibleExtraFiles = FilterPaths(series.Path, extraFiles);
            }

            CompletedScanning(series, possibleExtraFiles);
        }

        /// <summary>
        /// Checks whether any of the supplied files' codecs route the series to a different
        /// folder (root or processing). If so, moves the entire series folder to the target
        /// path, updates the series record, and queues a fresh rescan.
        /// Returns true when a move was performed (caller should abort the current scan).
        /// </summary>
        private bool ApplyCodecRouting(Series series, List<EpisodeFile> candidateFiles)
        {
            foreach (var file in candidateFiles)
            {
                var videoFormat = file.MediaInfo?.VideoFormat;
                if (videoFormat.IsNullOrWhiteSpace())
                {
                    continue;
                }

                var targetSeriesPath = _folderRoutingService.GetRoutedSeriesPath(series, videoFormat);

                if (targetSeriesPath.IsNullOrWhiteSpace() || targetSeriesPath.PathEquals(series.Path))
                {
                    continue;
                }

                _logger.Info("Codec routing: series '{0}' codec '{1}' requires path '{2}' (currently '{3}'). Moving.",
                    series.Title, videoFormat, targetSeriesPath, series.Path);

                try
                {
                    if (_diskProvider.FolderExists(series.Path))
                    {
                        // Ensure the parent destination directory exists.
                        var parentDir = Path.GetDirectoryName(targetSeriesPath);
                        if (parentDir.IsNotNullOrWhiteSpace() && !_diskProvider.FolderExists(parentDir))
                        {
                            _diskProvider.CreateFolder(parentDir);
                        }

                        _diskProvider.MoveFolder(series.Path, targetSeriesPath);
                        _logger.Debug("Moved series folder from '{0}' to '{1}'.", series.Path, targetSeriesPath);
                    }

                    series.Path = targetSeriesPath;
                    _seriesService.UpdateSeries(series, updateEpisodesToMatchSeason: false, publishUpdatedEvent: false);

                    // Queue a rescan so Sonarr picks up the files at the new location.
                    _commandQueue.Push(
                        new RescanSeriesCommand(series.Id),
                        CommandPriority.Normal,
                        CommandTrigger.Unspecified);

                    return true;
                }
                catch (Exception ex)
                {
                    _logger.Error(ex, "Failed to apply codec routing for series '{0}' to '{1}'.",
                        series.Title, targetSeriesPath);
                }

                // Only evaluate the first routable file — all files in the series share the same base path.
                break;
            }

            return false;
        }

        private void CleanMediaFiles(Series series, List<string> mediaFileList)
        {
            _logger.Debug("{0} Cleaning up media files in DB", series);
            _mediaFileTableCleanupService.Clean(series, mediaFileList);
        }

        private void CompletedScanning(Series series, List<string> possibleExtraFiles)
        {
            _logger.Info("Completed scanning disk for {0}", series.Title);
            _eventAggregator.PublishEvent(new SeriesScannedEvent(series, possibleExtraFiles));
        }

        public string[] GetVideoFiles(string path, bool allDirectories = true)
        {
            _logger.Debug("Scanning '{0}' for video files", path);

            var filesOnDisk = _diskProvider.GetFiles(path, allDirectories).ToList();

            var mediaFileList = filesOnDisk.Where(file => MediaFileExtensions.Extensions.Contains(Path.GetExtension(file)))
                                           .ToList();

            _logger.Trace("{0} files were found in {1}", filesOnDisk.Count, path);
            _logger.Debug("{0} video files were found in {1}", mediaFileList.Count, path);

            return mediaFileList.ToArray();
        }

        public string[] GetNonVideoFiles(string path, bool allDirectories = true)
        {
            _logger.Debug("Scanning '{0}' for non-video files", path);

            var filesOnDisk = _diskProvider.GetFiles(path, allDirectories).ToList();

            var mediaFileList = filesOnDisk.Where(file => !MediaFileExtensions.Extensions.Contains(Path.GetExtension(file)))
                                           .ToList();

            _logger.Trace("{0} files were found in {1}", filesOnDisk.Count, path);
            _logger.Debug("{0} non-video files were found in {1}", mediaFileList.Count, path);

            return mediaFileList.ToArray();
        }

        public List<string> FilterPaths(string basePath, IEnumerable<string> paths, bool filterExtras = true)
        {
            var filteredPaths = paths.Where(path => !ExcludedSubFoldersRegex.IsMatch(basePath.GetRelativePath(path)))
                        .Where(path => !ExcludedFilesRegex.IsMatch(Path.GetFileName(path)))
                        .ToList();

            if (filterExtras)
            {
                filteredPaths = filteredPaths.Where(path => !ExcludedExtrasSubFolderRegex.IsMatch(basePath.GetRelativePath(path)))
                                             .Where(path => !ExcludedExtraFilesRegex.IsMatch(Path.GetFileName(path)))
                                             .ToList();
            }

            return filteredPaths;
        }

        public static List<string> FilteredSubFolderMatches(string subfolder)
        {
            var matches = new List<string>();

            foreach (var match in ExcludedSubFoldersRegex.Matches(subfolder))
            {
                matches.Add(match.ToString());
            }

            foreach (var match in ExcludedExtrasSubFolderRegex.Matches(subfolder))
            {
                matches.Add(match.ToString());
            }

            foreach (var match in ExcludedExtraFilesRegex.Matches(subfolder))
            {
                matches.Add(match.ToString());
            }

            return matches;
        }

        private void SetPermissions(string path)
        {
            if (!_configService.SetPermissionsLinux)
            {
                return;
            }

            try
            {
                _diskProvider.SetPermissions(path, _configService.ChmodFolder, _configService.ChownGroup);
            }
            catch (Exception ex)
            {
                _logger.Warn(ex, "Unable to apply permissions to: " + path);
                _logger.Debug(ex, ex.Message);
            }
        }

        private void RemoveEmptySeriesFolder(string path)
        {
            if (_configService.DeleteEmptyFolders)
            {
                _diskProvider.RemoveEmptySubfolders(path);

                if (_diskProvider.FolderEmpty(path))
                {
                    _diskProvider.DeleteFolder(path, true);
                }
            }
        }

        public void Execute(RescanSeriesCommand message)
        {
            if (message.SeriesId.HasValue)
            {
                var series = _seriesService.GetSeries(message.SeriesId.Value);
                Scan(series);
            }
            else
            {
                var allSeries = _seriesService.GetAllSeries();

                foreach (var series in allSeries)
                {
                    Scan(series);
                }
            }
        }
    }
}
