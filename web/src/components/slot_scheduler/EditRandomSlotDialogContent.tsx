import { betterHumanize } from '@/helpers/dayjs.ts';
import { ProgramOption, getRandomSlotId } from '@/helpers/slotSchedulerUtil';
import { countWhere } from '@/helpers/util.ts';
import { useAdjustRandomSlotWeights } from '@/hooks/slot_scheduler/useAdjustRandomSlotWeights.ts';
import { useScheduledSlotProgramDetails } from '@/hooks/slot_scheduler/useScheduledSlotProgramDetails.ts';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { Warning } from '@mui/icons-material';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Slider,
  Stack,
  TextField,
  TextFieldProps,
} from '@mui/material';
import { TimeField } from '@mui/x-date-pickers';
import { RandomSlot } from '@tunarr/types/api';
import dayjs, { Dayjs } from 'dayjs';
import { isFunction, isNil, map } from 'lodash-es';
import React, { useCallback, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';

type EditRandomSlotDialogContentProps = {
  slot: RandomSlot;
  index: number;
  programOptions: ProgramOption[];
  onClose: () => void;
};

const mergeAdornments = (...adornments: React.ReactNode[]) => {
  const nonNullAdornments = adornments.filter((el) => el != null);
  if (nonNullAdornments.length === 0) {
    return null;
  }

  if (nonNullAdornments.length === 1) {
    return nonNullAdornments[0];
  }

  return (
    <Stack direction="row">
      {nonNullAdornments.map((adornment, index) => (
        <React.Fragment key={index}>{adornment}</React.Fragment>
      ))}
    </Stack>
  );
};

const PickerTextField = ({
  showWarning,
  ...rest
}: TextFieldProps & { showWarning: boolean }) => (
  <TextField
    {...rest}
    slotProps={{
      input: {
        ...rest.slotProps?.input,
        endAdornment: mergeAdornments(
          showWarning ? (
            <InputAdornment position="end">
              <IconButton
                // onClick={() => setCurrentSlotWarningsIndex(row.index)}
                size="small"
                sx={{ fontSize: '1rem', py: 0 }}
                disableRipple
                edge="end"
              >
                <Warning
                  // sx={{ fontSize: 'inherit' }}
                  color="warning"
                />
              </IconButton>
            </InputAdornment>
          ) : null,
          !isFunction(rest.slotProps?.input)
            ? rest.slotProps?.input?.endAdornment
            : null,
        ),
      },
    }}
  />
);

export const EditRandomSlotDialogContent = ({
  slot,
  index,
  programOptions,
  onClose,
}: EditRandomSlotDialogContentProps) => {
  const randomSlotForm = useRandomSlotFormContext();
  const { slotArray } = randomSlotForm;
  const [currentSlots, distribution] = randomSlotForm.watch([
    'slots',
    'randomDistribution',
  ]);

  const formMethods = useForm({
    defaultValues: slot,
  });
  const { control, watch, getValues, setValue } = formMethods;

  const [programming, slotDuration] = watch([`programming`, 'durationMs']);
  const [weightValue, setWeightValue] = useState(getValues('weight'));

  const handleWeightChange = (_: Event, newValue: number | number[]) => {
    setWeightValue(newValue as number);
  };

  const adjustSlotWeights = useAdjustRandomSlotWeights();

  const setFormWeightValue = (
    _: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => {
    const newWeights = adjustSlotWeights(index, newValue as number, 1);
    if (newWeights) {
      setValue('weight', newWeights[index]);
      randomSlotForm.setValue(
        'slots',
        map(currentSlots, (slot, idx) => ({
          ...slot,
          weight: newWeights[idx],
        })),
      );
    }
  };

  const commit = () => {
    slotArray.update(index, getValues());
    onClose();
  };

  const updateSlotTime = useCallback(
    (
      fieldValue: Dayjs | null,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      if (!fieldValue) return;
      const h = fieldValue.hour();
      const m = fieldValue.minute();
      const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
      originalOnChange(millis);
    },
    [],
  );

  const slotId = getRandomSlotId(programming);
  const programDetails = useScheduledSlotProgramDetails([slotId]);
  const overTimeCount = useMemo(() => {
    if (programDetails[slotId]) {
      return countWhere(
        programDetails[slotId]?.programDurations,
        ({ duration }) => duration > slotDuration,
      );
    }
    return 0;
  }, [programDetails, slotDuration, slotId]);

  return (
    <>
      <DialogContent>
        <Box
          sx={{
            pt: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <Stack gap={2} useFlexGap>
            <Stack direction="row" gap={1}>
              <Controller
                control={control}
                name="durationMs"
                render={({ field, fieldState: { error } }) => {
                  return (
                    <TimeField
                      format="H[h] m[m] s[s]"
                      {...field}
                      value={dayjs().startOf('day').add(field.value)}
                      onChange={(value) =>
                        updateSlotTime(value, field.onChange)
                      }
                      label="Duration"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !isNil(error),
                          helperText: betterHumanize(
                            dayjs.duration(field.value),
                            { exact: true, style: 'full' },
                          ),
                        },
                      }}
                    />
                  );
                }}
              />
              <Controller
                control={control}
                name="cooldownMs"
                render={({ field, fieldState: { error } }) => {
                  return (
                    <TimeField
                      format="H[h] m[m] s[s]"
                      {...field}
                      value={dayjs().startOf('day').add(field.value)}
                      onChange={(value) =>
                        updateSlotTime(value, field.onChange)
                      }
                      label="Cooldown"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !isNil(error),
                          helperText: betterHumanize(
                            dayjs.duration(field.value),
                            { exact: true, style: 'full' },
                          ),
                        },
                      }}
                    />
                  );
                }}
              />
            </Stack>
            <FormProvider {...formMethods}>
              <EditSlotProgrammingForm programOptions={programOptions} />
            </FormProvider>
            {distribution === 'weighted' && (
              <Stack direction="row" spacing={2} alignItems="center">
                <Slider
                  min={0}
                  max={100}
                  value={weightValue}
                  step={0.1}
                  onChange={handleWeightChange}
                  onChangeCommitted={setFormWeightValue}
                  sx={{
                    width: '90%',
                    '& .MuiSlider-thumb': {
                      transition: 'left 0.1s',
                    },
                    '& .MuiSlider-thumb.MuiSlider-active': {
                      transition: 'left 0s',
                    },
                    '& .MuiSlider-track': {
                      transition: 'width 0.1s',
                    },
                  }}
                />
                <TextField
                  type="number"
                  label="Weight %"
                  value={weightValue}
                  disabled
                />
              </Stack>
            )}
            {/* {isShowType && (
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Controller
                  control={control}
                  name="order"
                  render={({ field }) => (
                    <Select label="Order" {...field}>
                      {map(showOrderOptions, ({ description, value }) => (
                        <MenuItem key={value} value={value}>
                          {description}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>
            )} */}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button onClick={() => commit()} variant="contained">
          Save
        </Button>
      </DialogActions>
    </>
  );
};
