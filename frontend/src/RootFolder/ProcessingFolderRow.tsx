import React, { useCallback, useState } from 'react';
import Label from 'Components/Label';
import IconButton from 'Components/Link/IconButton';
import ConfirmModal from 'Components/Modal/ConfirmModal';
import TableRowCell from 'Components/Table/Cells/TableRowCell';
import TableRow from 'Components/Table/TableRow';
import { icons, kinds } from 'Helpers/Props';
import formatBytes from 'Utilities/Number/formatBytes';
import translate from 'Utilities/String/translate';
import { ProcessingFolder, useDeleteProcessingFolder } from './useProcessingFolders';
import styles from './RootFolderRow.css';

type ProcessingFolderRowProps = ProcessingFolder;

function ProcessingFolderRow(props: ProcessingFolderRowProps) {
  const {
    id,
    path,
    accessible,
    freeSpace = 0,
  } = props;

  const isUnavailable = !accessible;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { deleteProcessingFolder } = useDeleteProcessingFolder(id);

  const onDeletePress = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, [setIsDeleteModalOpen]);

  const onDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, [setIsDeleteModalOpen]);

  const onConfirmDelete = useCallback(() => {
    deleteProcessingFolder();
    setIsDeleteModalOpen(false);
  }, [deleteProcessingFolder]);

  return (
    <TableRow>
      <TableRowCell>
        <div className={styles.pathContainer}>
          {path}

          {isUnavailable ? (
            <Label className={styles.label} kind={kinds.DANGER}>
              {translate('Unavailable')}
            </Label>
          ) : null}
        </div>
      </TableRowCell>

      <TableRowCell className={styles.freeSpace}>
        {isUnavailable || isNaN(Number(freeSpace))
          ? '-'
          : formatBytes(freeSpace)}
      </TableRowCell>

      <TableRowCell className={styles.actions}>
        <IconButton
          title={translate('RemoveRootFolder')}
          aria-label={translate('RemoveRootFolder')}
          name={icons.REMOVE}
          onPress={onDeletePress}
        />
      </TableRowCell>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        kind={kinds.DANGER}
        title={translate('RemoveRootFolder')}
        message={translate('RemoveRootFolderWithSeriesMessageText', { path })}
        confirmLabel={translate('Remove')}
        onConfirm={onConfirmDelete}
        onCancel={onDeleteModalClose}
      />
    </TableRow>
  );
}

export default ProcessingFolderRow;
