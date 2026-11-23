/** A chassis number (VIN) is 17 letters and digits, never I, O or Q. Typed text is cleaned as it goes. */
export const cleanVin = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IOQ]/g, '').slice(0, 17);
/** Empty is fine (optional); otherwise it must be the full 17. */
export const vinOk = (v: string) => v === '' || v.length === 17;
