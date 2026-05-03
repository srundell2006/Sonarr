using FluentMigrator;
using NzbDrone.Core.Datastore.Migration.Framework;

namespace NzbDrone.Core.Datastore.Migration
{
    [Migration(233)]
    public class add_folder_ids_to_series : NzbDroneMigrationBase
    {
        protected override void MainDbUpgrade()
        {
            Alter.Table("Series")
                 .AddColumn("RootFolderId").AsInt32().Nullable();

            Alter.Table("Series")
                 .AddColumn("ProcessingFolderId").AsInt32().Nullable();
        }
    }
}
