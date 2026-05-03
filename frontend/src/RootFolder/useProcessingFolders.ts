import { useQueryClient } from '@tanstack/react-query';
import ModelBase from 'App/ModelBase';
import useApiMutation, {
  addOrUpdateQueryClientItem,
} from 'Helpers/Hooks/useApiMutation';
import useApiQuery from 'Helpers/Hooks/useApiQuery';

export interface ProcessingFolder extends ModelBase {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace?: number;
  totalSpace?: number;
  folderType: number;
}

interface AddProcessingFolder {
  path: string;
}

const DEFAULT_PROCESSING_FOLDERS: ProcessingFolder[] = [];

const useProcessingFolders = () => {
  const result = useApiQuery<ProcessingFolder[]>({
    path: '/processingFolder',
  });

  return {
    ...result,
    data: result.data ?? DEFAULT_PROCESSING_FOLDERS,
  };
};

export default useProcessingFolders;

export const useDeleteProcessingFolder = (id: number) => {
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useApiMutation<unknown, void>({
    path: `/processingFolder/${id}`,
    method: 'DELETE',
    mutationOptions: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/processingFolder'] });
      },
    },
  });

  return {
    deleteProcessingFolder: mutate,
    isDeleting: isPending,
    deleteError: error,
  };
};

export const useAddProcessingFolder = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, error, data } = useApiMutation<
    ProcessingFolder,
    AddProcessingFolder
  >({
    path: '/processingFolder',
    method: 'POST',
    mutationOptions: {
      onSuccess: (newFolder) => {
        queryClient.setQueryData<ProcessingFolder[]>(
          ['/processingFolder'],
          (oldFolders = []) =>
            addOrUpdateQueryClientItem(oldFolders, newFolder, 'id')
        );
      },
    },
  });

  return {
    addProcessingFolder: mutate,
    isAdding: isPending,
    addError: error,
    newProcessingFolder: data,
  };
};
