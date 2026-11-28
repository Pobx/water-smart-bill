import React, { useEffect, useState } from 'react'
import type { RateTier } from '@/features/billing/utils/waterBillCalculator'
import type { Homeowner, WaterMeterItem } from '@/shared/types/waterSmartBill'
import { tariffsMetersApi } from './tariffsMetersApi'
import type { TierEditorSavePayload } from './TierEditor'

export function useTariffsMeters(
  homeowners: Homeowner[],
  token?: string,
  onVatUpdated?: (vat: number) => void
) {
  const [rateConfigId, setRateConfigId] = useState<number>(1)
  const [vatRate, setVatRate] = useState<number>(7)
  const [reserveFee, setReserveFee] = useState(10)
  const [tiers, setTiers] = useState<RateTier[]>([
    { tier_order: 1, min_units: 1, max_units: 10, rate_per_unit: 5, comment: 'หน่วยที่ 1 - 10 (ครัวเรือนประหยัด)' },
    { tier_order: 2, min_units: 11, max_units: 20, rate_per_unit: 7, comment: 'หน่วยที่ 11 - 20' },
    { tier_order: 3, min_units: 21, max_units: 50, rate_per_unit: 10, comment: 'หน่วยที่ 21 - 50' },
    { tier_order: 4, min_units: 51, max_units: null, rate_per_unit: 12, comment: 'ตั้งแต่ 51 หน่วยขึ้นไป' },
  ])
  const [isSavingRateConfig, setIsSavingRateConfig] = useState(false)
  const [rateConfigError, setRateConfigError] = useState<string | null>(null)
  const [rateConfigSuccess, setRateConfigSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    tariffsMetersApi
      .getRateConfig(token)
      .then((cfg) => {
        if (cancelled || !cfg) return
        if (typeof cfg.id === 'number' && cfg.id > 0) setRateConfigId(cfg.id)
        if (typeof cfg.reserve_fee === 'number') setReserveFee(cfg.reserve_fee)
        if (typeof cfg.vat === 'number') {
          setVatRate(cfg.vat)
          onVatUpdated?.(cfg.vat)
        }
        if (Array.isArray(cfg.tiers) && cfg.tiers.length > 0) {
          setTiers(cfg.tiers)
        }
      })
      .catch(() => {
        // Keep seeded defaults when offline or backend unavailable in unit tests
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSaveRateConfig(payload: TierEditorSavePayload) {
    setIsSavingRateConfig(true)
    setRateConfigError(null)
    setRateConfigSuccess(null)
    try {
      if (token) {
        const updated = await tariffsMetersApi.updateRateConfig(rateConfigId, payload, token)
        setReserveFee(updated.reserve_fee)
        setVatRate(updated.vat)
        setTiers(updated.tiers)
        onVatUpdated?.(updated.vat)
      } else {
        setReserveFee(payload.reserve_fee)
        setVatRate(payload.vat)
        setTiers(payload.tiers)
        onVatUpdated?.(payload.vat)
      }
      setRateConfigSuccess('บันทึกอัตราค่าน้ำและ VAT สำเร็จ')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถบันทึกอัตราค่าน้ำได้'
      setRateConfigError(msg)
    } finally {
      setIsSavingRateConfig(false)
    }
  }
  const [periods, setPeriods] = useState(['11/2569', '10/2569'])
  const [newPeriodName, setNewPeriodName] = useState('')

  const [meters, setMeters] = useState<WaterMeterItem[]>([
    {
      meter_id: 1,
      meternumber: 'HSG-0001',
      factory_no: 'SN-2026-0001',
      user_id: 1,
      homeowner_name: 'นายสมหมาย ใจดี',
      house_no: '101/1',
      zone_id: 1,
      zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ',
      last_meter_recording: 120,
      status: 'active',
    },
    {
      meter_id: 2,
      meternumber: 'HSG-0002',
      factory_no: 'SN-2026-0002',
      user_id: 2,
      homeowner_name: 'นางมาลี ศรีสุข',
      house_no: '205/4',
      zone_id: 2,
      zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้',
      last_meter_recording: 85,
      status: 'active',
    },
  ])
  const [newMeterOwnerId, setNewMeterOwnerId] = useState(1)
  const [newMeterNumber, setNewMeterNumber] = useState('')
  const [newMeterInitialReading, setNewMeterInitialReading] = useState('0')

  function handleRegisterMeter(e: React.FormEvent) {
    e.preventDefault()
    if (!newMeterNumber.trim()) return
    const owner = homeowners.find((h) => h.id === newMeterOwnerId) ?? homeowners[0]
    const nextId = meters.length + 1
    setMeters([
      ...meters,
      {
        meter_id: nextId,
        meternumber: newMeterNumber.trim(),
        factory_no: `SN-2026-000${nextId}`,
        user_id: owner.id,
        homeowner_name: `${owner.prefix}${owner.firstname} ${owner.lastname}`.trim(),
        house_no: owner.house_no,
        zone_id: owner.zone_id,
        zone_name: owner.zone_name,
        last_meter_recording: Number(newMeterInitialReading) || 0,
        status: 'active',
      },
    ])
    setNewMeterNumber('')
    setNewMeterInitialReading('0')
  }

  function handleCreatePeriod() {
    if (newPeriodName.trim()) {
      setPeriods([newPeriodName.trim(), ...periods])
      setNewPeriodName('')
    }
  }

  return {
    rateConfigId,
    vatRate,
    setVatRate,
    reserveFee,
    setReserveFee,
    tiers,
    setTiers,
    isSavingRateConfig,
    rateConfigError,
    rateConfigSuccess,
    handleSaveRateConfig,
    periods,
    newPeriodName,
    setNewPeriodName,
    meters,
    setMeters,
    newMeterOwnerId,
    setNewMeterOwnerId,
    newMeterNumber,
    setNewMeterNumber,
    newMeterInitialReading,
    setNewMeterInitialReading,
    handleRegisterMeter,
    handleCreatePeriod,
  }
}
