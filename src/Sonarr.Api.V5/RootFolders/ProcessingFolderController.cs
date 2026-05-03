using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using NzbDrone.Core.RootFolders;
using NzbDrone.Core.Validation.Paths;
using NzbDrone.SignalR;
using Sonarr.Http;
using Sonarr.Http.Extensions;
using Sonarr.Http.REST;
using Sonarr.Http.REST.Attributes;

namespace Sonarr.Api.V5.RootFolders;

[V5ApiController("processingFolder")]
public class ProcessingFolderController : RestControllerWithSignalR<RootFolderResource, RootFolder>
{
    private readonly IRootFolderService _rootFolderService;

    public ProcessingFolderController(IRootFolderService rootFolderService,
                            IBroadcastSignalRMessage signalRBroadcaster,
                            RootFolderValidator rootFolderValidator,
                            PathExistsValidator pathExistsValidator,
                            MappedNetworkDriveValidator mappedNetworkDriveValidator,
                            RecycleBinValidator recycleBinValidator,
                            StartupFolderValidator startupFolderValidator,
                            SystemFolderValidator systemFolderValidator,
                            FolderWritableValidator folderWritableValidator)
    : base(signalRBroadcaster)
    {
        _rootFolderService = rootFolderService;

        SharedValidator.RuleFor(c => c.Path)
            .Cascade(CascadeMode.Stop)
            .IsValidPath()
                       .SetValidator(rootFolderValidator)
                       .SetValidator(mappedNetworkDriveValidator)
                       .SetValidator(startupFolderValidator)
                       .SetValidator(recycleBinValidator)
                       .SetValidator(pathExistsValidator)
                       .SetValidator(systemFolderValidator)
                       .SetValidator(folderWritableValidator);
    }

    protected override RootFolderResource GetResourceById(int id)
    {
        var timeout = Request?.GetBooleanQueryParameter("timeout", true) ?? true;

        return _rootFolderService.Get(id, timeout).ToResource();
    }

    [RestPostById]
    [Consumes("application/json")]
    public Results<Created<RootFolderResource>, NotFound> CreateProcessingFolder([FromBody] RootFolderResource resource)
    {
        var model = resource.ToModel();
        model.FolderType = RootFolderType.Processing;

        return TypedCreated(_rootFolderService.Add(model).Id);
    }

    [HttpGet]
    [Produces("application/json")]
    public Ok<List<RootFolderResource>> GetProcessingFolders()
    {
        return TypedResults.Ok(_rootFolderService.AllProcessingFoldersWithDetails().ToResource());
    }

    [RestPutById]
    [Consumes("application/json")]
    public Results<Accepted<RootFolderResource>, NotFound> UpdateProcessingFolder([FromBody] RootFolderResource resource)
    {
        _rootFolderService.Update(resource.ToModel());
        return TypedAccepted(resource.Id);
    }

    [RestDeleteById]
    public NoContent DeleteFolder(int id)
    {
        _rootFolderService.Remove(id);

        return TypedResults.NoContent();
    }
}
