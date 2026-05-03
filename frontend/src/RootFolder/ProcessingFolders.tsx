import React from 'react';
import Alert from 'Components/Alert';
import LoadingIndicator from 'Components/Loading/LoadingIndicator';
import Column from 'Components/Table/Column';
import Table from 'Components/Table/Table';
import TableBody from 'Components/Table/TableBody';
import { kinds } from 'Helpers/Props';
import translate from 'Utilities/String/translate';
import ProcessingFolderRow from './ProcessingFolderRow';
import useProcessingFolders from './useProcessingFolders';

const processingFolderColumns: Column[] = [
  {
    name: 'path',
    label: () => translate('Path'),
    isVisible: true,
  },
  {
    name: 'freeSpace',
    label: () => translate('FreeSpace'),
    isVisible: true,
  },
  {
    name: 'codecs',
    label: () => translate('Codecs'),
    isVisible: true,
  },
  {
    name: 'actions',
    label: '',
    isVisible: true,
  },
];

function ProcessingFolders() {
  const { isFetching, isFetched, error, data } = useProcessingFolders();

  if (isFetching && !isFetched) {
    return <LoadingIndicator />;
  }

  if (!isFetching && !!error) {
    return (
      <Alert kind={kinds.DANGER}>{translate('RootFoldersLoadError')}</Alert>
    );
  }

  return (
    <Table columns={processingFolderColumns}>
      <TableBody>
        {data.map((folder) => {
          return (
            <ProcessingFolderRow
              key={folder.id}
              id={folder.id}
              path={folder.path}
              accessible={folder.accessible}
              freeSpace={folder.freeSpace}
              folderType={folder.folderType}
              codecs={folder.codecs ?? []}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

export default ProcessingFolders;
