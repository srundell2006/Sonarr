import React, { useCallback, useState } from 'react';
import Alert from 'Components/Alert';
import FileBrowserModal from 'Components/FileBrowser/FileBrowserModal';
import Icon from 'Components/Icon';
import Button from 'Components/Link/Button';
import { icons, kinds, sizes } from 'Helpers/Props';
import { useAddProcessingFolder } from 'RootFolder/useProcessingFolders';
import translate from 'Utilities/String/translate';
import styles from './AddRootFolder.css';

function AddProcessingFolder() {
  const { addProcessingFolder, isAdding, addError } = useAddProcessingFolder();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const onAddPress = useCallback(() => {
    setIsAddModalOpen(true);
  }, [setIsAddModalOpen]);

  const onFolderSelect = useCallback(
    ({ value }: { value: string }) => {
      addProcessingFolder({ path: value });
    },
    [addProcessingFolder]
  );

  const onModalClose = useCallback(() => {
    setIsAddModalOpen(false);
  }, [setIsAddModalOpen]);

  return (
    <>
      {!isAdding && addError ? (
        <Alert kind={kinds.DANGER}>
          {translate('AddRootFolderError')}

          <ul>
            {Array.isArray(addError.statusBody) ? (
              addError.statusBody.map((e, index) => {
                return <li key={index}>{e.errorMessage}</li>;
              })
            ) : (
              <li>{JSON.stringify(addError.statusBody)}</li>
            )}
          </ul>
        </Alert>
      ) : null}

      <div className={styles.addRootFolderButtonContainer}>
        <Button
          kind={kinds.PRIMARY}
          size={sizes.LARGE}
          onPress={onAddPress}
        >
          <Icon className={styles.importButtonIcon} name={icons.DRIVE} />
          {translate('AddRootFolder')}
        </Button>

        <FileBrowserModal
          isOpen={isAddModalOpen}
          name="processingFolderPath"
          value=""
          onChange={onFolderSelect}
          onModalClose={onModalClose}
        />
      </div>
    </>
  );
}

export default AddProcessingFolder;
