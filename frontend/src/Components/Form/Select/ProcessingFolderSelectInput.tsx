import React, { useCallback, useMemo } from 'react';
import useProcessingFolders from 'RootFolder/useProcessingFolders';
import { EnhancedSelectInputChanged, InputChanged } from 'typings/inputs';
import sortByProp from 'Utilities/Array/sortByProp';
import translate from 'Utilities/String/translate';
import EnhancedSelectInput, {
  EnhancedSelectInputProps,
  EnhancedSelectInputValue,
} from './EnhancedSelectInput';
import RootFolderSelectInputOption from './RootFolderSelectInputOption';
import RootFolderSelectInputSelectedValue from './RootFolderSelectInputSelectedValue';

const NONE_KEY = 'none';

export interface ProcessingFolderSelectInputValue
  extends EnhancedSelectInputValue<string> {
  freeSpace?: number;
  isMissing?: boolean;
}

export interface ProcessingFolderSelectInputProps
  extends Omit<
    EnhancedSelectInputProps<ProcessingFolderSelectInputValue, string>,
    'value' | 'values' | 'onChange'
  > {
  name: string;
  // Numeric folder ID; -1 or undefined means "None (Automatic)"
  value?: number;
  onChange: (change: InputChanged<number>) => void;
}

function ProcessingFolderSelectInput({
  name,
  value,
  onChange,
  ...otherProps
}: ProcessingFolderSelectInputProps) {
  const { data: processingFolders } = useProcessingFolders();

  const values = useMemo((): ProcessingFolderSelectInputValue[] => {
    const sorted = [...processingFolders].sort(sortByProp('path'));

    return [
      {
        key: NONE_KEY,
        get value() {
          return translate('Automatic');
        },
      },
      ...sorted.map((folder) => ({
        key: String(folder.id),
        value: folder.path,
        freeSpace: folder.freeSpace,
        isMissing: !folder.accessible,
      })),
    ];
  }, [processingFolders]);

  // Convert numeric ID → string key used by EnhancedSelectInput
  const currentKey =
    value != null && value !== -1 ? String(value) : NONE_KEY;

  const handleChange = useCallback(
    ({ value: newKey }: EnhancedSelectInputChanged<string>) => {
      const numericValue = newKey === NONE_KEY ? -1 : parseInt(newKey, 10);
      onChange({ name, value: numericValue });
    },
    [name, onChange]
  );

  return (
    <EnhancedSelectInput
      {...otherProps}
      name={name}
      value={currentKey}
      values={values}
      selectedValueComponent={RootFolderSelectInputSelectedValue}
      optionComponent={RootFolderSelectInputOption}
      onChange={handleChange}
    />
  );
}

export default ProcessingFolderSelectInput;
