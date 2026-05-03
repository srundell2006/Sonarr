import React, { useCallback, useState } from 'react';
import Label from 'Components/Label';
import IconButton from 'Components/Link/IconButton';
import Link from 'Components/Link/Link';
import ConfirmModal from 'Components/Modal/ConfirmModal';
import TableRowCell from 'Components/Table/Cells/TableRowCell';
import TableRow from 'Components/Table/TableRow';
import { icons, kinds } from 'Helpers/Props';
import formatBytes from 'Utilities/Number/formatBytes';
import translate from 'Utilities/String/translate';
import { RootFolder, useDeleteRootFolder, useUpdateRootFolder } from './useRootFolders';
import styles from './RootFolderRow.css';

type RootFolderRowProps = RootFolder;

const KNOWN_CODECS = ['AVC', 'HEVC', 'AV1', 'VP9', 'VP8', 'MPEG2', 'VC1'];

function RootFolderRow(props: RootFolderRowProps) {
  const {
    id,
    path,
    accessible,
    isEmpty,
    freeSpace = 0,
    unmappedFolders = [],
    codecs = [],
    folderType,
  } = props;

  const isUnavailable = !accessible;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingCodecs, setIsEditingCodecs] = useState(false);
  const [pendingCodecs, setPendingCodecs] = useState<string[]>(codecs);

  const { deleteRootFolder } = useDeleteRootFolder(id);
  const { updateRootFolder } = useUpdateRootFolder(id);

  const onDeletePress = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, [setIsDeleteModalOpen]);

  const onDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, [setIsDeleteModalOpen]);

  const onConfirmDelete = useCallback(() => {
    deleteRootFolder();
    setIsDeleteModalOpen(false);
  }, [deleteRootFolder]);

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
    updateRootFolder({
      id,
      path,
      folderType,
      codecs: pendingCodecs,
    } as RootFolder);
    setIsEditingCodecs(false);
  }, [updateRootFolder, id, path, folderType, pendingCodecs]);

  const onCancelEditCodecs = useCallback(() => {
    setIsEditingCodecs(false);
  }, []);

  return (
    <TableRow>
      <TableRowCell>
        <div className={styles.pathContainer}>
          {isUnavailable ? (
            path
          ) : (
            <Link className={styles.link} to={`/add/import/${id}`}>
              {path}
            </Link>
          )}

          {isUnavailable ? (
            <Label className={styles.label} kind={kinds.DANGER}>
              {translate('Unavailable')}
            </Label>
          ) : null}

          {accessible && isEmpty ? (
            <Label
              className={styles.label}
              kind={kinds.WARNING}
              title={translate('EmptyRootFolderTooltip')}
            >
              {translate('Empty')}
            </Label>
          ) : null}
        </div>
      </TableRowCell>

      <TableRowCell className={styles.freeSpace}>
        {isUnavailable || isNaN(Number(freeSpace))
          ? '-'
          : formatBytes(freeSpace)}
      </TableRowCell>

      <TableRowCell className={styles.unmappedFolders}>
        {isUnavailable ? '-' : unmappedFolders.length}
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

export default RootFolderRow;
