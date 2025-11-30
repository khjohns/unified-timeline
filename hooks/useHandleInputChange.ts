import { useCallback, Dispatch, SetStateAction } from 'react';
import { FormDataModel } from '../types';

/**
 * Creates a handleInputChange function for complex nested form updates
 *
 * This is extracted from useSkjemaData to be usable with any setFormData.
 *
 * Handles:
 * - Simple object updates (sak, varsel)
 * - Array-based updates (koe_revisjoner, bh_svar_revisjoner)
 * - Nested path updates (e.g., "vederlag.krav_vederlag")
 * - Automatic error clearing when fields are updated
 *
 * @param setFormData - State setter for form data
 * @param setErrors - State setter for errors
 * @returns handleInputChange function
 */
export const useHandleInputChange = (
  setFormData: Dispatch<SetStateAction<FormDataModel>> | ((data: FormDataModel | ((prev: FormDataModel) => FormDataModel)) => void),
  setErrors: Dispatch<SetStateAction<Record<string, string>>>
) => {
  const handleInputChange = useCallback(
    (
      section: keyof Omit<FormDataModel, 'versjon' | 'rolle'>,
      field: string,
      value: any,
      index?: number
    ) => {
      setFormData((prev: FormDataModel) => {
        const path = field.split('.');

        // Handle array-based sections (koe_revisjoner, bh_svar_revisjoner)
        if (section === 'koe_revisjoner' || section === 'bh_svar_revisjoner') {
          const arraySection = prev[section] as any[];
          const targetIndex = index !== undefined ? index : arraySection.length - 1;

          if (path.length === 1) {
            const updatedArray = [...arraySection];
            updatedArray[targetIndex] = {
              ...updatedArray[targetIndex],
              [field]: value,
            };
            return { ...prev, [section]: updatedArray };
          }

          if (path.length === 2) {
            const [nestedObjectKey, nestedFieldKey] = path;
            const updatedArray = [...arraySection];
            updatedArray[targetIndex] = {
              ...updatedArray[targetIndex],
              [nestedObjectKey]: {
                ...updatedArray[targetIndex][nestedObjectKey],
                [nestedFieldKey]: value,
              },
            };
            return { ...prev, [section]: updatedArray };
          }
        }

        // Handle non-array sections (sak, varsel)
        if (path.length === 1) {
          return {
            ...prev,
            [section]: {
              ...prev[section],
              [field]: value,
            },
          };
        }

        if (path.length === 2) {
          const [nestedObjectKey, nestedFieldKey] = path;
          return {
            ...prev,
            [section]: {
              ...prev[section],
              [nestedObjectKey]: {
                ...(prev[section] as any)[nestedObjectKey],
                [nestedFieldKey]: value,
              },
            },
          };
        }

        return prev;
      });

      // Clear error for this field if it exists
      const fieldId = `${section}.${field}`.replace(/\./g, '_');
      setErrors((prev) => {
        if (!prev[fieldId]) return prev;
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    },
    [setFormData, setErrors]
  );

  return handleInputChange;
};
