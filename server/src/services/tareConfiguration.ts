import { z } from 'zod';

export const tareConfigurationInput = z.object({
  tareType: z.enum(['SUBTRACTIVE', 'ADDITIVE']),
  maximumTareEffect: z.object({ value: z.number().finite().positive(), unit: z.enum(['mg', 'g', 'kg', 't']) }),
  tareOperationMode: z.enum(['NON_AUTOMATIC', 'SEMI_AUTOMATIC', 'AUTOMATIC']),
  tareWeighingDevicePresent: z.boolean(),
  presetTareDevicePresent: z.boolean(),
});

export function tareConfigurationCanBeEdited(reportStatus: unknown, tareTestStarted: boolean) {
  return reportStatus === 'TESTING' && !tareTestStarted;
}

export function applyTareConfiguration(current: Record<string, any>, input: z.infer<typeof tareConfigurationInput>) {
  if (current.tareDevicePresent === false || current.tareDevice === 'No') throw new Error('Tare configuration cannot be added to an instrument recorded without a tare device.');
  const unitFactor: Record<string, number> = { mg: 0.001, g: 1, kg: 1000, t: 1_000_000 };
  const maxTareInInstrumentUnit = input.maximumTareEffect.value * unitFactor[input.maximumTareEffect.unit] / unitFactor[current.unit || 'g'];
  if (!Number.isFinite(maxTareInInstrumentUnit) || maxTareInInstrumentUnit > Number(current.max)) throw new Error('Maximum tare effect must not exceed the instrument Max.');
  return {
    ...current,
    tareDevicePresent: true,
    tareType: input.tareType,
    maximumTareEffect: input.maximumTareEffect,
    tareOperationMode: input.tareOperationMode,
    tareWeighingDevicePresent: input.tareWeighingDevicePresent,
    presetTareDevicePresent: input.presetTareDevicePresent,
  };
}

export function applyTareConfigurationAtStart(currentReportSnapshot: Record<string, any>, input: unknown) {
  return applyTareConfiguration(currentReportSnapshot, tareConfigurationInput.parse(input));
}
