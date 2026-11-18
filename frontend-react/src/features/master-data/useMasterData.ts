import React, { useState } from 'react'
import {
  makeDefaultAvatarDataUri,
  type Homeowner,
  type OrganizationInfo,
  type VillageZone,
} from '@/shared/types/waterSmartBill'

export function useMasterData() {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo>({
    org_code: 'HSG1',
    org_name: 'องค์การบริหารส่วนตำบลห้องแซง',
    tambon_name: 'ห้องแซง',
    district_name: 'เลิงนกทา',
    province_name: 'ยโสธร',
    zipcode: '35120',
    phone: '045-777-111',
    dept_name: 'กองการประปา อบต.ห้องแซง',
    vat: 7,
  })

  const [zones, setZones] = useState<VillageZone[]>([
    { id: 1, moo_no: 1, zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ', tambon_name: 'ห้องแซง', subzone_name: 'สายจดที่ 1 (คุ้มวัดเหนือ)' },
    { id: 2, moo_no: 2, zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้', tambon_name: 'ห้องแซง', subzone_name: 'สายจดที่ 2 (คุ้มตลาดใต้)' },
  ])
  const [newZoneMoo, setNewZoneMoo] = useState('3')
  const [newZoneName, setNewZoneName] = useState('')
  const [newSubzoneName, setNewSubzoneName] = useState('')

  const [homeowners, setHomeowners] = useState<Homeowner[]>([
    {
      id: 1,
      prefix: 'นาย',
      firstname: 'สมหมาย',
      lastname: 'ใจดี',
      house_no: '101/1',
      zone_id: 1,
      zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ',
      tambon_name: 'ห้องแซง',
      phone: '081-234-5678',
      line_user_id: 'U1001_SOMMAI',
      image: '',
      avatar_url: makeDefaultAvatarDataUri('สมหมาย ใจดี'),
    },
    {
      id: 2,
      prefix: 'นาง',
      firstname: 'มาลี',
      lastname: 'ศรีสุข',
      house_no: '205/4',
      zone_id: 2,
      zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้',
      tambon_name: 'ห้องแซง',
      phone: '089-876-5432',
      line_user_id: 'U1002_MALEE',
      image: '',
      avatar_url: makeDefaultAvatarDataUri('มาลี ศรีสุข'),
    },
  ])

  const [prefix, setPrefix] = useState('นาย')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [houseNo, setHouseNo] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState(1)
  const [phone, setPhone] = useState('')
  const [uploadedAvatarDataUrl, setUploadedAvatarDataUrl] = useState('')

  function handleAddVillage(e: React.FormEvent) {
    e.preventDefault()
    if (!newZoneName.trim()) return
    const nextId = zones.length + 1
    setZones([
      ...zones,
      {
        id: nextId,
        moo_no: Number(newZoneMoo) || nextId,
        zone_name: newZoneName.trim(),
        tambon_name: orgInfo.tambon_name,
        subzone_name: newSubzoneName.trim() || `สายจดที่ ${nextId}`,
      },
    ])
    setNewZoneName('')
    setNewSubzoneName('')
  }

  function handleAddHomeowner(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !houseNo.trim()) return
    const zone = zones.find((z) => z.id === selectedZoneId) ?? zones[0]
    const nextId = homeowners.length + 1
    const fallbackAvatar = uploadedAvatarDataUrl.trim()
      ? uploadedAvatarDataUrl.trim()
      : makeDefaultAvatarDataUri(`${firstName} ${lastName}`)
    const newOwner: Homeowner = {
      id: nextId,
      prefix,
      firstname: firstName.trim(),
      lastname: lastName.trim(),
      house_no: houseNo.trim(),
      zone_id: zone.id,
      zone_name: zone.zone_name,
      tambon_name: orgInfo.tambon_name,
      phone: phone.trim() || '080-000-0000',
      line_user_id: `U_AUTO_${nextId}`,
      image: uploadedAvatarDataUrl.trim(),
      avatar_url: fallbackAvatar,
    }
    setHomeowners([...homeowners, newOwner])
    setFirstName('')
    setLastName('')
    setHouseNo('')
    setPhone('')
    setUploadedAvatarDataUrl('')
  }

  return {
    orgInfo,
    setOrgInfo,
    zones,
    newZoneMoo,
    setNewZoneMoo,
    newZoneName,
    setNewZoneName,
    newSubzoneName,
    setNewSubzoneName,
    homeowners,
    prefix,
    setPrefix,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    houseNo,
    setHouseNo,
    selectedZoneId,
    setSelectedZoneId,
    phone,
    setPhone,
    uploadedAvatarDataUrl,
    setUploadedAvatarDataUrl,
    handleAddVillage,
    handleAddHomeowner,
  }
}
