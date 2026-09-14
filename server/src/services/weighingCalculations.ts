export type ChangeoverCalculation = {
  trueIndicationP: number;
  rawErrorE: number;
  correctedErrorEc: number;
};

/** OIML R 76-1:2006 A.4.4.3 changeover calculation shared by performance tests. */
export function calculateChangeoverError(loadL: number, indicationI: number, deltaL: number, e: number, zeroErrorE0 = 0): ChangeoverCalculation {
  const trueIndicationP = indicationI + (0.5 * e) - deltaL;
  const rawErrorE = trueIndicationP - loadL;
  return { trueIndicationP, rawErrorE, correctedErrorEc: rawErrorE - zeroErrorE0 };
}

/** E0 at zero load for the digital changeover method, where L0 = 0. */
export function calculateZeroError(zeroIndicationI0: number, deltaL0: number, e: number) {
  return zeroIndicationI0 + (0.5 * e) - deltaL0;
}
