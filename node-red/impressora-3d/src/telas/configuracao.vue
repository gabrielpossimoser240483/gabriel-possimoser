<template>
  <div class="i3d">
    <div v-if="!f" class="i3d-vazio">Carregando configuração…</div>
    <template v-else>
      <div class="i3d-form">
        <v-text-field v-model="f.nome" label="Nome da impressora" density="compact" variant="outlined" hide-details></v-text-field>
        <v-select v-model="f.tipo" :items="tipos" label="Tipo de servidor" density="compact" variant="outlined" hide-details></v-select>
        <v-text-field v-model="f.url" :label="bambu ? 'IP da impressora' : 'Endereço'" :placeholder="bambu ? '192.168.0.50' : (f.tipo === 'octoprint' ? 'http://192.168.0.50' : 'http://192.168.0.50:7125')" density="compact" variant="outlined" hide-details></v-text-field>
        <v-text-field v-if="bambu" v-model="f.serial" label="Número de série" placeholder="ex.: 03919C4A2600123" density="compact" variant="outlined" hide-details></v-text-field>
        <v-text-field v-model="f.apiKey" :label="bambu ? 'Código de acesso (8 dígitos)' : (f.tipo === 'octoprint' ? 'Chave de API (obrigatória)' : 'Chave de API (opcional)')" type="password" density="compact" variant="outlined" hide-details autocomplete="new-password"></v-text-field>
        <v-select v-if="!bambu" v-model="f.webcamModo" :items="modos" label="Câmera" density="compact" variant="outlined" hide-details></v-select>
        <v-text-field v-model.number="f.webcamIntervalo" type="number" label="Intervalo entre fotos (s)" density="compact" variant="outlined" hide-details></v-text-field>
        <v-text-field v-if="!bambu" v-model="f.webcamSnapshot" label="URL da foto (vazio = automático)" density="compact" variant="outlined" hide-details></v-text-field>
        <v-text-field v-if="!bambu" v-model="f.webcamStream" label="URL do vídeo (vazio = automático)" density="compact" variant="outlined" hide-details></v-text-field>
        <v-text-field v-model.number="f.bicoMax" type="number" label="Temperatura máx. do bico (°C)" density="compact" variant="outlined" hide-details></v-text-field>
        <v-text-field v-model.number="f.mesaMax" type="number" label="Temperatura máx. da mesa (°C)" density="compact" variant="outlined" hide-details></v-text-field>
      </div>

      <div class="i3d-titulo">Pré-aquecimentos</div>
      <div v-for="(p, i) in f.presets" :key="i" class="i3d-linha" style="margin-bottom:6px">
        <v-text-field v-model="p.nome" label="Material" density="compact" variant="outlined" hide-details style="max-width:140px"></v-text-field>
        <v-text-field v-model.number="p.bico" type="number" label="Bico °C" density="compact" variant="outlined" hide-details style="max-width:110px"></v-text-field>
        <v-text-field v-model.number="p.mesa" type="number" label="Mesa °C" density="compact" variant="outlined" hide-details style="max-width:110px"></v-text-field>
        <v-btn size="small" variant="text" icon="mdi-delete-outline" @click="f.presets.splice(i, 1)"></v-btn>
      </div>
      <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="f.presets.push({ nome: '', bico: 200, mesa: 60 })">Adicionar material</v-btn>

      <div class="i3d-linha" style="margin-top:14px">
        <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" @click="salvar">Salvar e conectar</v-btn>
        <v-btn variant="text" @click="restaurar">Voltar ao padrão do fluxo</v-btn>
        <span v-if="salvo" class="i3d-sub">✔ Salvo</span>
      </div>
      <div v-if="bambu" class="i3d-sub" style="margin-top:8px; line-height:1.6">
        <b>Onde achar na tela da A1:</b> Configurações (engrenagem) → <b>Rede / WLAN</b>: IP e <b>código de acesso</b> ·
        Configurações → <b>Dispositivo</b>: número de série.<br>
        Para os botões funcionarem, ative <b>Modo somente LAN</b> e <b>Modo desenvolvedor</b> nas configurações de rede
        (com isso o Bambu Handy e a nuvem deixam de funcionar). Para a câmera, ative também <b>LAN Only Liveview</b>, se aparecer.
      </div>
      <div v-else class="i3d-sub" style="margin-top:8px">
        Klipper: use o endereço do Moonraker (porta 7125, ou a mesma do Mainsail/Fluidd).
        OctoPrint: crie a chave em Configurações → Application Keys (ou API).
      </div>
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      f: null, salvo: false,
      tipos: [{ title: 'Bambu Lab (A1, A1 mini, P1, X1)', value: 'bambu' }, { title: 'Klipper (Moonraker / Mainsail / Fluidd)', value: 'moonraker' }, { title: 'OctoPrint', value: 'octoprint' }],
      modos: [{ title: 'Fotos pelo Node-RED (funciona fora de casa)', value: 'snapshot' }, { title: 'Vídeo direto (só na rede local)', value: 'stream' }]
    }
  },
  computed: { bambu() { return this.f && this.f.tipo === 'bambu' } },
  watch: {
    msg: {
      immediate: true,
      handler(m) {
        if (!m || !m.payload || m.topic !== 'cfg') return
        this.f = JSON.parse(JSON.stringify(m.payload))
        if (!Array.isArray(this.f.presets)) this.f.presets = []
        if (m.salvoEm) { this.salvo = true; setTimeout(() => { this.salvo = false }, 3000) }
      }
    }
  },
  methods: {
    salvar() {
      const p = JSON.parse(JSON.stringify(this.f))
      p.presets = (p.presets || []).filter(x => x.nome)
      this.send({ topic: 'salvar', payload: p })
    },
    restaurar() { this.send({ topic: 'restaurar', payload: {} }) }
  }
}
</script>

<style>
.i3d-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
</style>
