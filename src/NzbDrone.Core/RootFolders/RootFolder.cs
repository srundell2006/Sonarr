using System.Collections.Generic;
using NzbDrone.Core.Datastore;

namespace NzbDrone.Core.RootFolders
{
    public enum RootFolderType
    {
        RootFolder = 0,
        Processing = 1
    }

    public class RootFolder : ModelBase
    {
        public RootFolder()
        {
            Codecs = new List<string>();
            UnmappedFolders = new List<UnmappedFolder>();
        }

        public string Path { get; set; }
        public bool Accessible { get; set; }
        public bool IsEmpty { get; set; }
        public long? FreeSpace { get; set; }
        public long? TotalSpace { get; set; }
        public RootFolderType FolderType { get; set; }

        /// <summary>
        /// Video codec names (e.g. "AVC", "HEVC", "AV1") that should be stored in this folder.
        /// Empty means "accept any codec".
        /// </summary>
        public List<string> Codecs { get; set; }

        public List<UnmappedFolder> UnmappedFolders { get; set; }
    }
}
