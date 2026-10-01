import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import dayjs from 'dayjs'
import { COLORS } from '../constants/theme'
import { ORA_RECHARGE_URL, type MyOraEsim } from '../lib/oraFly'

/**
 * eSIM ORA FLY dans « Mes eSIM ». Pas de jauge de consommation ni de recharge
 * dans l'app : l'eSIM n'est pas chez Airalo, la recharge se fait chez ORA.
 */
export default function OraEsimCard({ esim }: { esim: MyOraEsim }) {
  const [showQr, setShowQr] = useState(false)
  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{esim.package_name}</Text>
          <Text style={s.sub}>
            Polynésie française · réseau ORA
            {esim.assigned_at ? ` · achetée le ${dayjs(esim.assigned_at).format('DD/MM/YYYY')}` : ''}
          </Text>
        </View>
        <Text style={s.flag}>🇵🇫</Text>
      </View>

      <View style={s.row}><Text style={s.label}>ICCID</Text><Text style={s.val} selectable>{esim.iccid}</Text></View>
      <View style={s.row}><Text style={s.label}>Adresse SM-DP+</Text><Text style={s.val} selectable>{esim.smdp_address || '-'}</Text></View>
      <View style={[s.row, { borderBottomWidth: 0 }]}><Text style={s.label}>Code d'activation</Text><Text style={s.val} selectable>{esim.matching_code || '-'}</Text></View>

      {showQr && <Image source={{ uri: esim.qr_code_url }} style={s.qr} resizeMode="contain" />}

      <View style={s.actions}>
        <TouchableOpacity style={s.btn} onPress={() => setShowQr(!showQr)}>
          <Ionicons name="qr-code-outline" size={16} color={COLORS.violet} />
          <Text style={s.btnTxt}>{showQr ? 'Masquer le QR' : 'Afficher le QR'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(ORA_RECHARGE_URL)}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.violet} />
          <Text style={s.btnTxt}>Recharger chez ORA</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  flag: { fontSize: 26 },
  row: { paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  label: { fontSize: 11, color: COLORS.textMuted },
  val: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 1 },
  qr: { width: 200, height: 200, alignSelf: 'center', marginVertical: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: 'rgba(210,81,216,0.35)', borderRadius: 12, paddingVertical: 10 },
  btnTxt: { fontSize: 12, fontWeight: '700', color: COLORS.violet },
})
