<template>
  <div class="i3d">
    <div class="i3d-linha">
      <v-text-field v-model="busca" density="compact" hide-details variant="outlined" prepend-inner-icon="mdi-magnify"
        placeholder="Buscar arquivo" clearable style="flex:1; min-width:160px"></v-text-field>
      <v-btn size="small" variant="tonal" icon="mdi-refresh" title="Atualizar lista" @click="enviar('atualizarListas')"></v-btn>
    </div>
    <div class="i3d-sub" style="margin:6px 0">{{ filtrados.length }} de {{ lista.length }} arquivos · clique para selecionar</div>

    <div class="i3d-rolagem" style="max-height:320px">
      <table class="i3d-tabela">
        <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Data</th><th v-if="temEstimativa">Tempo</th></tr></thead>
        <tbody>
          <tr v-for="a in filtrados.slice(0, 300)" :key="a.caminho" class="clicavel" :class="{ sel: sel && sel.caminho === a.caminho }" @click="escolher(a)">
            <td><div class="i3d-elipse" :title="a.caminho">{{ a.nome }}</div><div v-if="a.pasta" class="i3d-sub">{{ a.pasta }}</div></td>
            <td class="i3d-num" style="white-space:nowrap">{{ tamanho(a.tamanho) }}</td>
            <td class="i3d-num" style="white-space:nowrap">{{ data(a.modificado) }}</td>
            <td v-if="temEstimativa" class="i3d-num" style="white-space:nowrap">{{ dur(a.estimativa) }}</td>
          </tr>
          <tr v-if="!filtrados.length"><td colspan="4" class="i3d-vazio">Nenhum arquivo.</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="sel" class="i3d-confirma" style="border-color: rgba(var(--v-theme-primary), .5); background: rgba(var(--v-theme-primary), .06)">
      <div style="margin-bottom:8px"><b>{{ sel.nome }}</b><br><span class="i3d-sub">{{ sel.caminho }} · {{ tamanho(sel.tamanho) }}</span></div>
      <div class="i3d-linha">
        <v-btn color="primary" variant="flat" size="small" prepend-icon="mdi-printer-3d" @click="imprimir">Imprimir</v-btn>
        <v-btn variant="text" size="small" @click="sel = null">Fechar</v-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() { return { busca: '', sel: null } },
  computed: {
    lista() { return (this.msg && this.msg.payload && this.msg.payload.lista) || [] },
    temEstimativa() { return this.lista.some(a => a.estimativa) },
    filtrados() {
      const b = (this.busca || '').toLowerCase()
      return this.lista.filter(a => !b || a.caminho.toLowerCase().includes(b)).sort((x, y) => y.modificado - x.modificado)
    }
  },
  methods: {
    escolher(a) { this.sel = this.sel && this.sel.caminho === a.caminho ? null : a },
    imprimir() { this.send({ topic: 'comando', payload: { acao: 'imprimir', arquivo: this.sel.caminho } }); this.sel = null },
    enviar(acao) { this.send({ topic: 'comando', payload: { acao } }) },
    tamanho(b) { return !b ? '—' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB' },
    data(t) { return t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' },
    dur(s) { if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + 'h' + String(m).padStart(2, '0') : m + 'min' }
  }
}
</script>
