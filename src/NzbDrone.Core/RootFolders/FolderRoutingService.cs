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
            // We pass null for sceneName because we are matching against stored labels, not guessing.
            var codecLabel = MediaInfoFormatter.FormatVideoCodec(
                new MediaInfoModel { VideoFormat = videoFormat },
                null);

            if (codecLabel.IsNullOrWhiteSpace())
            {
                return null;
            }

            RootFolder targetFolder;

            if (series.RootFolderId.HasValue)
            {
                // Explicit override: use whatever folder the user pinned the series to.
                try
                {
                    targetFolder = _rootFolderService.Get(series.RootFolderId.Value, false);
                }
                catch
                {
                    _logger.Warn("Series {0} has RootFolderId={1} but that folder no longer exists; skipping routing.",
                        series.Title, series.RootFolderId);
                    return null;
                }
            }
            else
            {
                // Automatic: find the first root folder whose Codecs list contains the codec label.
                targetFolder = _rootFolderService.AllRootFolders()
                    .FirstOrDefault(f => f.Codecs != null &&
                                        f.Codecs.Any(c => c.Equals(codecLabel, System.StringComparison.OrdinalIgnoreCase)));

                if (targetFolder == null)
                {
                    _logger.Debug("No root folder configured for codec '{0}'; leaving series {1} in place.",
                        codecLabel, series.Title);
                    return null;
                }
            }

            // Derive the series folder name from the current path (last directory component).
            var seriesFolderName = new DirectoryInfo(series.Path).Name;
            var routedPath = Path.Combine(targetFolder.Path, seriesFolderName);

            if (routedPath.PathEquals(series.Path))
            {
                return null;
            }

            _logger.Debug("Codec '{0}' → routing series '{1}' from '{2}' to '{3}'.",
                codecLabel, series.Title, series.Path, routedPath);

            return routedPath;
        }
    }
}
