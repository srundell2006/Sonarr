import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SeriesMonitorNewItemsOptionsPopoverContent from 'AddSeries/SeriesMonitorNewItemsOptionsPopoverContent';
import Form from 'Components/Form/Form';
import FormGroup from 'Components/Form/FormGroup';
import FormInputButton from 'Components/Form/FormInputButton';
import FormInputGroup from 'Components/Form/FormInputGroup';
import FormLabel from 'Components/Form/FormLabel';
import Icon from 'Components/Icon';
import Button from 'Components/Link/Button';
import SpinnerErrorButton from 'Components/Link/SpinnerErrorButton';
import ModalBody from 'Components/Modal/ModalBody';
import ModalContent from 'Components/Modal/ModalContent';
import ModalFooter from 'Components/Modal/ModalFooter';
import ModalHeader from 'Components/Modal/ModalHeader';
import Popover from 'Components/Tooltip/Popover';
import { usePendingChangesStore } from 'Helpers/Hooks/usePendingChangesStore';
import usePrevious from 'Helpers/Hooks/usePrevious';
import {
  icons,
  inputTypes,
  kinds,
  sizes,
  tooltipPositions,
} from 'Helpers/Props';
import useRootFolders from 'RootFolder/useRootFolders';
import MoveSeriesModal from 'Series/MoveSeries/MoveSeriesModal';
import Series from 'Series/Series';
import { useSaveSeries, useSingleSeries } from 'Series/useSeries';
import selectSettings from 'Store/Selectors/selectSettings';
import { InputChanged } from 'typings/inputs';
import translate from 'Utilities/String/translate';
import ProcessingFolderModal from './ProcessingFolder/ProcessingFolderModal';
import { ProcessingFolderUpdated } from './ProcessingFolder/ProcessingFolderModalContent';
import RootFolderModal from './RootFolder/RootFolderModal';
import { RootFolderUpdated } from './RootFolder/RootFolderModalContent';
import styles from './EditSeriesModalContent.css';

export interface EditSeriesModalContentProps {
  seriesId: number;
  onModalClose: () => void;
  onDeleteSeriesPress: () => void;
}
function EditSeriesModalContent({
  seriesId,
  onModalClose,
  onDeleteSeriesPress,
}: EditSeriesModalContentProps) {
  const series = useSingleSeries(seriesId)!;

  const {
    title,
    monitored,
    monitorNewItems,
    seasonFolder,
    qualityProfileId,
    seriesType,
    path,
    tags,
    rootFolderPath: initialRootFolderPath,
    rootFolderId,
    processingPath: initialProcessingPath,
  } = series;

  const { pendingChanges, setPendingChange } = usePendingChangesStore<Series>(
    {}
  );

  const { data: rootFolders } = useRootFolders();

  const rootFolderOptions = useMemo(() => [
    { key: -1, value: translate('Automatic') },
    ...rootFolders.map((f) => ({ key: f.id, value: f.path })),
  ], [rootFolders]);

  const [isRootFolderModalOpen, setIsRootFolderModalOpen] = useState(false);
  const [rootFolderPath, setRootFolderPath] = useState(initialRootFolderPath);
  const [isProcessingFolderModalOpen, setIsProcessingFolderModalOpen] = useState(false);
  const [processingPath, setProcessingPath] = useState(initialProcessingPath ?? '');
  const isPathChanging = !!(
    pendingChanges.path && path !== pendingChanges.path
  );
  const [isConfirmMoveModalOpen, setIsConfirmMoveModalOpen] = useState(false);

  // Two separate mutation instances so we can pass the correct moveFiles flag at
  // call time rather than at hook-initialization time.
  const {
    saveSeries: saveSeriesNoMove,
    isSaving: isSavingNoMove,
    saveError: saveErrorNoMove,
  } = useSaveSeries(false);
  const {
    saveSeries: saveSeriesWithMove,
    isSaving: isSavingWithMove,
    saveError: saveErrorWithMove,
  } = useSaveSeries(true);

  const isSaving = isSavingNoMove || isSavingWithMove;
  const saveError = saveErrorNoMove ?? saveErrorWithMove;
  const wasSaving = usePrevious(isSaving);

  const { settings, ...otherSettings } = useMemo(() => {
    return selectSettings(
      {
        monitored,
        monitorNewItems,
        seasonFolder,
        qualityProfileId,
        seriesType,
        path,
        tags,
        rootFolderId: rootFolderId ?? -1,
        processingPath: initialProcessingPath ?? '',
      },
      pendingChanges,
      saveError
    );
  }, [
    monitored,
    monitorNewItems,
    seasonFolder,
    qualityProfileId,
    seriesType,
    path,
    tags,
    rootFolderId,
    initialProcessingPath,
    pendingChanges,
    saveError,
  ]);

  const handleInputChange = useCallback(
    ({ name, value }: InputChanged) => {
      // Convert sentinel -1 back to undefined for folder ID fields
      const normalizedValue =
        (name === 'rootFolderId' || name === 'processingFolderId') && value === -1
          ? undefined
          : value;
      // @ts-expect-error name needs to be keyof Series
      setPendingChange(name, normalizedValue);
    },
    [setPendingChange]
  );

  const handleRootFolderPress = useCallback(() => {
    setIsRootFolderModalOpen(true);
  }, []);

  const handleRootFolderModalClose = useCallback(() => {
    setIsRootFolderModalOpen(false);
  }, []);

  const handleRootFolderChange = useCallback(
    ({
      path: newPath,
      rootFolderPath: newRootFolderPath,
    }: RootFolderUpdated) => {
      setIsRootFolderModalOpen(false);
      setRootFolderPath(newRootFolderPath);
      handleInputChange({ name: 'path', value: newPath });
    },
    [handleInputChange]
  );

  const handleProcessingFolderPress = useCallback(() => {
    setIsProcessingFolderModalOpen(true);
  }, []);

  const handleProcessingFolderModalClose = useCallback(() => {
    setIsProcessingFolderModalOpen(false);
  }, []);

  const handleProcessingFolderChange = useCallback(
    ({ processingPath: newProcessingPath, processingFolderId: newProcessingFolderId }: ProcessingFolderUpdated) => {
      setIsProcessingFolderModalOpen(false);
      setProcessingPath(newProcessingPath);
      handleInputChange({ name: 'processingPath', value: newProcessingPath });
      handleInputChange({ name: 'processingFolderId', value: newProcessingFolderId ?? undefined });
    },
    [handleInputChange]
  );

  const handleCancelPress = useCallback(() => {
    setIsConfirmMoveModalOpen(false);
  }, []);

  const handleSavePress = useCallback(() => {
    if (isPathChanging && !isConfirmMoveModalOpen) {
      setIsConfirmMoveModalOpen(true);
    } else {
      // "Don't Move Files" path (or normal save when path isn't changing).
      setIsConfirmMoveModalOpen(false);

      saveSeriesNoMove({
        ...series,
        ...pendingChanges,
      });
    }
  }, [
    series,
    isPathChanging,
    isConfirmMoveModalOpen,
    pendingChanges,
    saveSeriesNoMove,
  ]);

  const handleMoveSeriesPress = useCallback(() => {
    setIsConfirmMoveModalOpen(false);

    saveSeriesWithMove({
      ...series,
      ...pendingChanges,
    });
  }, [series, pendingChanges, saveSeriesWithMove]);

  useEffect(() => {
    if (!isSaving && wasSaving && !saveError) {
      onModalClose();
    }
  }, [isSaving, wasSaving, saveError, onModalClose]);

  return (
    <ModalContent onModalClose={onModalClose}>
      <ModalHeader>{translate('EditSeriesModalHeader', { title })}</ModalHeader>

      <ModalBody>
        <Form {...otherSettings}>
          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('Monitored')}</FormLabel>

            <FormInputGroup
              type={inputTypes.CHECK}
              name="monitored"
              helpText={translate('MonitoredEpisodesHelpText')}
              {...settings.monitored}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>
              {translate('MonitorNewSeasons')}
              <Popover
                anchor={<Icon className={styles.labelIcon} name={icons.INFO} />}
                title={translate('MonitorNewSeasons')}
                body={<SeriesMonitorNewItemsOptionsPopoverContent />}
                position={tooltipPositions.RIGHT}
              />
            </FormLabel>

            <FormInputGroup
              type={inputTypes.MONITOR_NEW_ITEMS_SELECT}
              name="monitorNewItems"
              helpText={translate('MonitorNewSeasonsHelpText')}
              {...settings.monitorNewItems}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('UseSeasonFolder')}</FormLabel>

            <FormInputGroup
              type={inputTypes.CHECK}
              name="seasonFolder"
              helpText={translate('UseSeasonFolderHelpText')}
              {...settings.seasonFolder}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('QualityProfile')}</FormLabel>

            <FormInputGroup
              type={inputTypes.QUALITY_PROFILE_SELECT}
              name="qualityProfileId"
              {...settings.qualityProfileId}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('SeriesType')}</FormLabel>

            <FormInputGroup
              type={inputTypes.SERIES_TYPE_SELECT}
              name="seriesType"
              {...settings.seriesType}
              helpText={translate('SeriesTypesHelpText')}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('Path')}</FormLabel>

            <FormInputGroup
              type={inputTypes.PATH}
              name="path"
              {...settings.path}
              buttons={[
                <FormInputButton
                  key="fileBrowser"
                  kind={kinds.DEFAULT}
                  title={translate('RootFolder')}
                  onPress={handleRootFolderPress}
                >
                  <Icon name={icons.ROOT_FOLDER} />
                </FormInputButton>,
              ]}
              includeFiles={false}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('Tags')}</FormLabel>

            <FormInputGroup
              type={inputTypes.TAG}
              name="tags"
              {...settings.tags}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('RootFolder')}</FormLabel>

            <FormInputGroup
              type={inputTypes.SELECT}
              name="rootFolderId"
              values={rootFolderOptions}
              helpText={translate('RootFolderCodecRoutingHelpText')}
              {...settings.rootFolderId}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup size={sizes.MEDIUM}>
            <FormLabel>{translate('ProcessingPath')}</FormLabel>

            <FormInputGroup
              type={inputTypes.PATH}
              name="processingPath"
              value={pendingChanges.processingPath ?? processingPath}
              helpText={translate('ProcessingFolderHelpText')}
              buttons={[
                <FormInputButton
                  key="processingFolderBrowser"
                  kind={kinds.DEFAULT}
                  title={translate('ProcessingFolder')}
                  onPress={handleProcessingFolderPress}
                >
                  <Icon name={icons.ROOT_FOLDER} />
                </FormInputButton>,
              ]}
              includeFiles={false}
              onChange={handleInputChange}
            />
          </FormGroup>
        </Form>
      </ModalBody>

      <ModalFooter>
        <Button
          className={styles.deleteButton}
          kind={kinds.DANGER}
          onPress={onDeleteSeriesPress}
        >
          {translate('Delete')}
        </Button>

        <Button onPress={onModalClose}>{translate('Cancel')}</Button>

        <SpinnerErrorButton
          error={saveError}
          isSpinning={isSaving}
          onPress={handleSavePress}
        >
          {translate('Save')}
        </SpinnerErrorButton>
      </ModalFooter>

      <RootFolderModal
        isOpen={isRootFolderModalOpen}
        seriesId={seriesId}
        rootFolderPath={rootFolderPath}
        onSavePress={handleRootFolderChange}
        onModalClose={handleRootFolderModalClose}
      />

      <ProcessingFolderModal
        isOpen={isProcessingFolderModalOpen}
        seriesId={seriesId}
        onSavePress={handleProcessingFolderChange}
        onModalClose={handleProcessingFolderModalClose}
      />

      <MoveSeriesModal
        originalPath={path}
        destinationPath={pendingChanges.path}
        isOpen={isConfirmMoveModalOpen}
        onModalClose={handleCancelPress}
        onSavePress={handleSavePress}
        onMoveSeriesPress={handleMoveSeriesPress}
      />
    </ModalContent>
  );
}

export default EditSeriesModalContent;
