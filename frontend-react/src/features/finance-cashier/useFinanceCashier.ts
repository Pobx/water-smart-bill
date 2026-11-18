import { useState, useEffect, useCallback, useMemo } from 'react'
import type { WaterInvoiceItem } from '@/shared/types/waterSmartBill'
import { financeCashierApi, type CollectionSummaryReport } from './financeCashierApi'

export function useFinanceCashier(token?: string) {
  const [invoices, setInvoices] = useState<WaterInvoiceItem[]>([])
  const [report, setReport] = useState<CollectionSummaryReport | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(undefined)

  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<WaterInvoiceItem | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'promptpay'>('cash')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [receiptModalInvoice, setReceiptModalInvoice] = useState<WaterInvoiceItem | null>(null)

  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadData = useCallback(async () => {
    setIsProcessing(true)
    try {
      const [invRes, reportRes] = await Promise.all([
        financeCashierApi.listInvoices(undefined, selectedPeriodId, token),
        financeCashierApi.getCollectionReport(selectedPeriodId, token).catch(() => null),
      ])
      setInvoices(invRes.items || [])
      if (reportRes) {
        setReport(reportRes)
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลบิลได้',
        type: 'error',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [selectedPeriodId, token])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Status filter
      if (filterStatus === 'unpaid' && inv.status === 'paid') return false
      if (filterStatus === 'paid' && inv.status !== 'paid') return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchInvNo = inv.inv_no.toLowerCase().includes(q)
        const matchHouse = inv.house_no.toLowerCase().includes(q)
        const matchName = inv.homeowner_name.toLowerCase().includes(q)
        const matchMeter = inv.meternumber.toLowerCase().includes(q)
        if (!matchInvNo && !matchHouse && !matchName && !matchMeter) {
          return false
        }
      }
      return true
    })
  }, [invoices, filterStatus, searchQuery])

  const handleOpenPayment = (inv: WaterInvoiceItem) => {
    setSelectedInvoiceForPayment(inv)
    setPaymentMethod('cash')
    setCashTendered(String(Math.ceil(inv.totalpaid)))
    setMessage(null)
  }

  const handleClosePayment = () => {
    setSelectedInvoiceForPayment(null)
    setCashTendered('')
  }

  const cashChange = useMemo(() => {
    if (!selectedInvoiceForPayment) return 0
    const tendered = parseFloat(cashTendered) || 0
    return Math.max(0, Math.round((tendered - selectedInvoiceForPayment.totalpaid) * 100) / 100)
  }, [cashTendered, selectedInvoiceForPayment])

  const isCashSufficient = useMemo(() => {
    if (!selectedInvoiceForPayment) return false
    if (paymentMethod === 'promptpay') return true
    const tendered = parseFloat(cashTendered) || 0
    return tendered >= selectedInvoiceForPayment.totalpaid
  }, [cashTendered, paymentMethod, selectedInvoiceForPayment])

  const handleConfirmPayment = async () => {
    if (!selectedInvoiceForPayment) return
    setIsProcessing(true)
    setMessage(null)

    try {
      const updated = await financeCashierApi.payInvoice(
        selectedInvoiceForPayment.id,
        paymentMethod,
        token
      )
      setMessage({
        text: `รับชำระเงินบิล ${updated.inv_no} สำเร็จ ออกใบเสร็จเลขที่ ${updated.receipt_no || 'RC-AUTO'}`,
        type: 'success',
      })
      handleClosePayment()
      setReceiptModalInvoice(updated)
      await loadData()
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรับชำระเงิน',
        type: 'error',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadCSV = async () => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const blob = await financeCashierApi.downloadCollectionReportCSV(selectedPeriodId, token)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `รายงานจัดเก็บค่าน้ำ-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setMessage({ text: 'ดาวน์โหลดรายงานสรุปการจัดเก็บ CSV เรียบร้อยแล้ว', type: 'success' })
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'ไม่สามารถดาวน์โหลดรายงาน CSV ได้',
        type: 'error',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrintReceipt = (inv: WaterInvoiceItem) => {
    setReceiptModalInvoice(inv)
  }

  return {
    invoices,
    filteredInvoices,
    report,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    selectedPeriodId,
    setSelectedPeriodId,
    selectedInvoiceForPayment,
    handleOpenPayment,
    handleClosePayment,
    paymentMethod,
    setPaymentMethod,
    cashTendered,
    setCashTendered,
    cashChange,
    isCashSufficient,
    handleConfirmPayment,
    receiptModalInvoice,
    setReceiptModalInvoice,
    handlePrintReceipt,
    handleDownloadCSV,
    isProcessing,
    message,
    loadData,
  }
}
