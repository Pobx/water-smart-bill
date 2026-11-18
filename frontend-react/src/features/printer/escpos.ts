export interface ThermalBillPayload {
  orgName: string
  invNo: string
  periodName: string
  meterNumber: string
  homeownerName: string
  houseNo: string
  lastMeter: number
  currentMeter: number
  waterUsed: number
  waterCharge: number
  reserveFee: number
  vat: number
  totalPaid: number
  status: string
  recordedAt: string
}

export function formatThermalReceiptText(bill: ThermalBillPayload): string {
  const divider = '--------------------------------'
  const docTitle = bill.status === 'paid' ? 'ใบเสร็จรับเงินค่าน้ำประปา' : 'ใบแจ้งหนี้ค่าน้ำประปา'
  return [
    bill.orgName,
    docTitle,
    divider,
    `เลขที่บิล : ${bill.invNo}`,
    `ประจำงวด : ${bill.periodName}`,
    `วันที่จด   : ${bill.recordedAt}`,
    divider,
    `เลขมิเตอร์: ${bill.meterNumber}`,
    `ผู้ใช้น้ำ  : ${bill.homeownerName}`,
    `บ้านเลขที่: ${bill.houseNo}`,
    divider,
    `เลขครั้งก่อน: ${bill.lastMeter} m3`,
    `เลขครั้งนี้ : ${bill.currentMeter} m3`,
    `หน่วยที่ใช้ : ${bill.waterUsed} m3`,
    divider,
    `ค่าน้ำประปา      : ${bill.waterCharge.toFixed(2)} บ.`,
    `ค่ารักษามิเตอร์   : ${bill.reserveFee.toFixed(2)} บ.`,
    `VAT 7%          : ${bill.vat.toFixed(2)} บ.`,
    divider,
    `ยอดชำระสุทธิ     : ${bill.totalPaid.toFixed(2)} บาท`,
    divider,
    'สแกนเช็คบิล/ชำระเงินผ่าน LINE LIFF',
    `LIFF Ref: ${bill.meterNumber}`,
  ].join('\n')
}

export function buildEscPosReceiptBytes(bill: ThermalBillPayload): Uint8Array {
  const encoder = new TextEncoder()
  const textBytes = encoder.encode(formatThermalReceiptText(bill) + '\n\n\n')
  // ESC @ (Initialize: 0x1B 0x40), ESC a 1 (Center align header), text, GS V 66 0 (Partial cut)
  const initCmd = new Uint8Array([0x1b, 0x40])
  const cutCmd = new Uint8Array([0x1d, 0x56, 0x42, 0x00])
  const out = new Uint8Array(initCmd.length + textBytes.length + cutCmd.length)
  out.set(initCmd, 0)
  out.set(textBytes, initCmd.length)
  out.set(cutCmd, initCmd.length + textBytes.length)
  return out
}

export async function printViaWebBluetooth(bill: ThermalBillPayload): Promise<{
  mode: 'bluetooth' | 'simulated-bluetooth'
  bytesSent: number
}> {
  const payload = buildEscPosReceiptBytes(bill)
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (opts: unknown) => Promise<{
        gatt?: {
          connect: () => Promise<{
            getPrimaryService: (s: string) => Promise<{
              getCharacteristic: (c: string) => Promise<{
                writeValue: (v: Uint8Array) => Promise<void>
              }>
            }>
          }>
        }
      }>
    }
  }

  if (nav.bluetooth) {
    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      })
      const server = await device.gatt?.connect()
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
      const char = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb')
      if (char) {
        await char.writeValue(payload)
        return { mode: 'bluetooth', bytesSent: payload.length }
      }
    } catch {
      // Fall through to simulated ESC/POS preview when user cancels Bluetooth dialog or in headless browser
    }
  }
  return { mode: 'simulated-bluetooth', bytesSent: payload.length }
}
