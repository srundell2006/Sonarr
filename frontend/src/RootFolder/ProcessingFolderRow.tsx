import React, { useCallback, useState } from 'react';
import Label from 'Components/Label';
import IconButton from 'Components/Link/IconButton';
import ConfirmModal from 'Components/Modal/ConfirmModal';
import TableRowCell from 'Components/Table/Cells/TableRowCell';
import TableRow from 'Components/Table/TableRow';
import { icons, kinds } from 'Helpers/Props';
import formatBytes from 'Utilities/Number/formatBytes';
import translate from 'Utilities/String/translate';
import { ProcessingFolder, useDeleteProcessingFolder, useUpdateProcessingFolder } from './useProcessingFolders';
import styles from './RootFolderRow.css';

type ProcessingFolderRowProps = ProcessingFolder;

const KNOWN_CODECS = ['AVC', 'HEVC', 'AV1', 'VP9', 'VP8', 'MPEG2', 'VC1'];

function ProcessingFolderRow(props: ProcessingFolderRowProps) {
  const {
    id,
    path,
    accessible,
    freeSpace = 0,
    codecs = [],
    folderType,
  } = props;

  const isUnavailable = !accessible;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingCodecs, setIsEditingCodecs] = useState(false);
  const [pendingCodecs, setPendingCodecs] = useState<string[]>(codecs);

  const { deleteProcessingFolder } = useDeleteProcessingFolder(id);
  const { updateProcessingFolder } = useUpdateProcessingFolder(id);

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

  const onEditCodecsPress = useCallback(() => {
    setPendingCodecs(codecs);
    setIsEditingCodecs(true);
  }, [codecs]);

  const onToggleCodec = useCallback((codec: string) => {
    setPendingCodecs((prev) =>
      prev.includes(codec) ? prev.filter((c) => c !== codec) : [...prev, codec]
    );
  }, []);

  const onSaveCodecs = useCallback(() => {
    updateProcessingFolder({
      id,
      path,
      folderType,
      codecs: pendingCodecs,
    } as ProcessingFolder);
    setIsEditingCodecs(false);
  }, [updateProcessingFolder, id, path, folderType, pendingCodecs]);

  const onCancelEditCodecs = useCallback(() => {
    setIsEditingCodecs(false);
  }, []);

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

      <TableRowCell>
        {isEditingCodecs ? (
          <div className={styles.codecEditor}>
            {KNOWN_CODECS.map((codec) => (
              <label key={codec} className={styles.codecCheckbox}>
                <input
                  type="checkbox"
                  checked={pendingCodecs.includes(codec)}
                  onChange={() => onToggleCodec(codec)}
                />
                {' '}{codec}
              </label>
            ))}
            <IconButton
              title={translate('Save')}
              name={icons.SAVE}
              onPress={onSaveCodecs}
            />
            <IconButton
              title={translate('Cancel')}
              name={icons.CLOSE}
              onPress={onCancelEditCodecs}
            />
          </div>
        ) : (
          <div className={styles.codecDisplay}>
            <span>
              {codecs.length > 0 ? codecs.join(', ') : translate('Any')}
            </span>
            <IconButton
              title={translate('EditCodecs')}
              name={icons.EDIT}
              onPress={onEditCodecsPress}
            />
          </div>
        )}
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
