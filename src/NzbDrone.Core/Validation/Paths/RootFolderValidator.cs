using FluentValidation.Validators;
using NzbDrone.Common.Disk;
using NzbDrone.Common.Extensions;
using NzbDrone.Core.RootFolders;

namespace NzbDrone.Core.Validation.Paths
{
    public class RootFolderValidator : PropertyValidator
    {
        private readonly IRootFolderService _rootFolderService;

        public RootFolderValidator(IRootFolderService rootFolderService)
        {
            _rootFolderService = rootFolderService;
        }

        protected override string GetDefaultMessageTemplate() => "Path '{path}' is already configured as a root folder";

        protected override bool IsValid(PropertyValidatorContext context)
        {
            if (context.PropertyValue == null)
            {
                return true;
            }

            context.MessageFormatter.AppendArgument("path", context.PropertyValue.ToString());

            // When updating an existing record the instance already has an Id > 0.
            // Exclude that record from the uniqueness check so a PUT that only changes
            // Codecs (but keeps the same Path) is not rejected.
            var currentId = (context.InstanceToValidate
                                 ?.GetType()
                                 .GetProperty("Id")
                                 ?.GetValue(context.InstanceToValidate) as int?) ?? 0;

            return !_rootFolderService.All().Exists(r =>
                r.Id != currentId &&
                r.Path.IsPathValid(PathValidationType.CurrentOs) &&
                r.Path.PathEquals(context.PropertyValue.ToString()));
        }
    }
}
