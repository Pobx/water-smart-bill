import { Command } from 'cmdk'
import type { WaterMeterItem } from '@/shared/types/waterSmartBill'

export interface MeterSearchComboboxProps {
  meters: WaterMeterItem[]
  selectedMeterId?: number | null
  onSelect: (meterId: number) => void
  placeholder?: string
  ariaLabel?: string
}

export function MeterSearchCombobox({
  meters,
  selectedMeterId,
  onSelect,
  placeholder = 'พิมพ์บ้านเลขที่ ชื่อเจ้าของ หรือเลขมิเตอร์เพื่อค้นหา...',
  ariaLabel = 'ค้นหาและเลือกมิเตอร์น้ำ',
}: MeterSearchComboboxProps) {
  return (
    <Command
      label={ariaLabel}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
    >
      <div className="flex items-center border-b border-slate-200 px-3">
        <span className="mr-2 text-xs text-slate-400" aria-hidden="true">
          🔍
        </span>
        <Command.Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          className="w-full bg-transparent py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <Command.List className="max-h-48 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-4 text-center text-xs text-slate-500">
          ไม่พบมิเตอร์ที่ตรงกับการค้นหา
        </Command.Empty>
        {meters.map((meter) => {
          const label = `${meter.house_no} | ${meter.homeowner_name} | ${meter.meternumber}`
          const isSelected = selectedMeterId === meter.meter_id
          return (
            <Command.Item
              key={meter.meter_id}
              value={label}
              onSelect={() => onSelect(meter.meter_id)}
              data-selected-meter={isSelected ? 'true' : 'false'}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors aria-selected:bg-sky-50 aria-selected:text-sky-900 ${
                isSelected
                  ? 'bg-sky-50 font-semibold text-sky-900 ring-1 ring-sky-200'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="truncate font-mono">{label}</span>
              {isSelected && (
                <span className="ml-2 shrink-0 text-[11px] font-bold text-sky-600">✓ เลือกอยู่</span>
              )}
            </Command.Item>
          )
        })}
      </Command.List>
    </Command>
  )
}
