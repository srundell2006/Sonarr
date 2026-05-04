import React, { useCallback, useMemo, useState } from 'react';
import FormGroup from 'Components/Form/FormGroup';
import FormInputGroup from 'Components/Form/FormInputGroup';
import FormLabel from 'Components/Form/FormLabel';
import Button from 'Components/Link/Button';
import ModalBody from 'Components/Modal/ModalBody';
import ModalContent from 'Components/Modal/ModalContent';
import ModalFooter from 'Components/Modal/ModalFooter';
import ModalHeader from 'Components/Modal/ModalHeader';
import useApiQuery from 'Helpers/Hooks/useApiQuery';
import { inputTypes } from 'Helpers/Props';
import useProcessingFolders from 'RootFolder/useProcessingFolders';
import { useIsWindows } from 'System/Status/useSystemStatus';
import { InputChanged } from 'typings/inputs';
import translate from 'Utilities/String/translate';

export interface ProcessingFolderUpdated {
  processingPath: string;
  processingFolderId: number | undefined;
}

export interface ProcessingFolderModalContentProps {
  seriesId: number;
  onSavePress(change: ProcessingFolderUpdated): void;
  onModalClose(): void;
}

interface SeriesFolder {
  folder: string;
}

function ProcessingFolderModalContent({
  seriesId,
  onSavePress,
  onModalClose,
}: ProcessingFolderModalContentProps) {
  const isWindows = useIsWindows();
  const [selectedFolderId, setSelectedFolderId] = useState<number>(-1);
  const { data: processingFolders } = useProcessingFolders();

  const { isLoading, data } = useApiQuery<SeriesFolder>({
    path: `/series/${seriesId}/folder`,
  });

  const selectedFolder = useMemo(
    () => processingFolders.find((f) => f.id === selectedFolderId),
    [processingFolders, selectedFolderId]
  );

  const previewPath = useMemo(() => {
    if (!selectedFolder || !data?.folder) {
      return null;
    }
    const separator = isWindows ? '\\' : '/';
    return `${selectedFolder.path}${separator}${data.folder}`;
  }, [selectedFolder, data, isWindows]);

  const onFolderChange = useCallback(({ value }: InputChanged<number>) => {
    setSelectedFolderId(value);
  }, []);

  const handleSavePress = useCallback(() => {
    if (!previewPath) {
      return;
    }

    onSavePress({
      processingPath: previewPath,
      processingFolderId: selectedFolderId === -1 ? undefined : selectedFolderId,
    });
  }, [previewPath, selectedFolderId, onSavePress]);

  return (
    <ModalContent onModalClose={onModalClose}>
      <ModalHeader>{translate('UpdateProcessingPath')}</ModalHeader>

      <ModalBody>
        <FormGroup>
          <FormLabel>{translate('ProcessingFolder')}</FormLabel>

          <FormInputGroup
            type={inputTypes.PROCESSING_FOLDER_SELECT}
            name="processingFolderId"
            value={selectedFolderId}
            helpText={translate('ProcessingFolderHelpText')}
            onChange={onFolderChange}
          />
        </FormGroup>

        {previewPath ? (
          <FormGroup>
            <FormLabel>{translate('SeriesPath')}</FormLabel>

            <FormInputGroup
              type={inputTypes.TEXT}
              name="processingPathPreview"
              value={previewPath}
              readOnly={true}
              onChange={() => {}}
            />
          </FormGroup>
        ) : null}
      </ModalBody>

      <ModalFooter>
        <Button onPress={onModalClose}>{translate('Cancel')}</Button>

        <Button disabled={isLoading || !previewPath} onPress={handleSavePress}>
          {translate('UpdatePath')}
        </Button>
      </ModalFooter>
    </ModalContent>
  );
}

export default ProcessingFolderModalContent;
