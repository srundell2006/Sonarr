using System.IO;
using System.Linq;
using NLog;
using NzbDrone.Common.Extensions;
using NzbDrone.Core.MediaFiles.MediaInfo;
using NzbDrone.Core.Tv;

namespace NzbDrone.Core.RootFolders
{
    public interface IFolderRoutingService
    {
        /// <summary>
        /// Given a series and the raw FFprobe VideoFormat string (e.g. "h264", "hevc", "av1"),
        /// returns the series path that the file should live in according to codec-based routing.
        /// Returns null when no routing change is necessary.
        /// </summary>
        string GetRoutedSeriesPath(Series series, string videoFormat);
    }

    public class FolderRoutingService : IFolderRoutingService
    {
        private readonly IRootFolderService _rootFolderService;
        private readonly Logger _logger;

        public FolderRoutingService(IRootFolderService rootFolderService, Logger logger)
        {
            _rootFolderService = rootFolderService;
            _logger = logger;
        }

        public string GetRoutedSeriesPath(Series series, string videoFormat)
        {
            if (videoFormat.IsNullOrWhiteSpace())
            {
                return null;
            }

            // Translate the raw FFprobe codec name to the common label (e.g. "h264" → "AVC").
            var codecLabel = MediaInfoFormatter.FormatVideoCodec(
                new MediaInfoModel { VideoFormat = videoFormat },
                null);

            if (codecLabel.IsNullOrWhiteSpace())
            {
                return null;
            }

            // Derive the series folder name from the current path (last directory component).
            var seriesFolderName = new DirectoryInfo(series.Path).Name;

            // Priority 1: explicit processing folder override set on the series.
            if (series.ProcessingFolderId.HasValue)
            {
                try
                {
                    var processingFolder = _rootFolderService.Get(series.ProcessingFolderId.Value, false);
                    var routedPath = Path.Combine(processingFolder.Path, seriesFolderName);
                    if (!routedPath.PathEquals(series.Path))
                    {
                        _logger.Debug("ProcessingFolderId override → routing series '{0}' to '{1}'.",
                            series.Title, routedPath);
                        return routedPath;
                    }

                    return null;
                }
                catch
                {
                    _logger.Warn("Series {0} has ProcessingFolderId={1} but that folder no longer exists; falling through to codec routing.",
                        series.Title, series.ProcessingFolderId);
                }
            }

            // Priority 2: explicit root folder override set on the series.
            if (series.RootFolderId.HasValue)
            {
                try
                {
                    var rootFolder = _rootFolderService.Get(series.RootFolderId.Value, false);
                    var routedPath = Path.Combine(rootFolder.Path, seriesFolderName);
                    if (!routedPath.PathEquals(series.Path))
                    {
                        _logger.Debug("RootFolderId override → routing series '{0}' to '{1}'.",
                            series.Title, routedPath);
                        return routedPath;
                    }

                    return null;
                }
                catch
                {
                    _logger.Warn("Series {0} has RootFolderId={1} but that folder no longer exists; falling through to codec routing.",
                        series.Title, series.RootFolderId);
                }
            }

            // Priority 3: auto-detect — processing folders first (more specific), then root folders.
            var targetFolder = _rootFolderService.AllProcessingFolders()
                .FirstOrDefault(f => f.Codecs != null &&
                                     f.Codecs.Any(c => c.Equals(codecLabel, System.StringComparison.OrdinalIgnoreCase)));

            if (targetFolder == null)
            {
                targetFolder = _rootFolderService.AllRootFolders()
                    .FirstOrDefault(f => f.Codecs != null &&
                                         f.Codecs.Any(c => c.Equals(codecLabel, System.StringComparison.OrdinalIgnoreCase)));
            }

            if (targetFolder == null)
            {
                _logger.Debug("No folder configured for codec '{0}'; leaving series '{1}' in place.",
                    codecLabel, series.Title);
                return null;
            }

            var autoRoutedPath = Path.Combine(targetFolder.Path, seriesFolderName);

            if (autoRoutedPath.PathEquals(series.Path))
            {
                return null;
            }

            _logger.Debug("Codec '{0}' → routing series '{1}' from '{2}' to '{3}'.",
                codecLabel, series.Title, series.Path, autoRoutedPath);

            return autoRoutedPath;
        }
    }
}
