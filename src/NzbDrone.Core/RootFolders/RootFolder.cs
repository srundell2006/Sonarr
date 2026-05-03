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
        public string Path { get; set; }
        public bool Accessible { get; set; }
        public bool IsEmpty { get; set; }
        public long? FreeSpace { get; set; }
        public long? TotalSpace { get; set; }
        public RootFolderType FolderType { get; set; }

        public List<UnmappedFolder> UnmappedFolders { get; set; }
    }
}
