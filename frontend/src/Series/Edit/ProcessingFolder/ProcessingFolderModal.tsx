import React from 'react';
import Modal from 'Components/Modal/Modal';
import ProcessingFolderModalContent, {
  ProcessingFolderModalContentProps,
} from './ProcessingFolderModalContent';

interface ProcessingFolderModalProps extends ProcessingFolderModalContentProps {
  isOpen: boolean;
}

function ProcessingFolderModal({
  isOpen,
  seriesId,
  onSavePress,
  onModalClose,
}: ProcessingFolderModalProps) {
  return (
    <Modal isOpen={isOpen} onModalClose={onModalClose}>
      <ProcessingFolderModalContent
        seriesId={seriesId}
        onSavePress={onSavePress}
        onModalClose={onModalClose}
      />
    </Modal>
  );
}

export default ProcessingFolderModal;
