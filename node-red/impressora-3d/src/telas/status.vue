<template>
  <div class="i3d">
    <div v-if="!e" class="i3d-vazio">Aguardando dados da impressora…</div>
    <template v-else>
      <div class="i3d-linha i3d-entre">
        <div class="i3d-linha">
          <v-chip :color="cor" variant="flat" size="small" class="font-weight-bold">{{ e.estadoTexto }}</v-chip>
          <span style="font-weight:600">{{ e.cfg.nome }}</span>
        </div>
        <span class="i3d-sub">{{ ({ octoprint: 'OctoPrint', bambu: 'Bambu Lab', moonraker: 'Klipper' })[e.tipo] }} · {{ hora(e.atualizadoEm, true) }}</span>
      </div>

      <div v-for="h in (e.hms || [])" :key="h.codigo" class="i3d-msg erro">⚠️ Aviso HMS <a :href="h.url" target="_blank" rel="noopener">{{ h.codigo }}</a> (toque para ver a solução)</div>
      <div v-if="e.mensagem" class="i3d-msg" :class="{ erro: ['erro','offline','desconectada'].includes(e.estado) }">{{ e.mensagem }}</div>

      <div v-if="e.arquivo" class="i3d-job">
        <img v-if="e.miniatura && !semMiniatura" :src="urlMiniatura" class="i3d-mini" @error="semMiniatura = true" alt="">
        <div class="i3d-job-info">
          <div class="i3d-arquivo" :title="e.arquivo">{{ e.nome }}</div>
          <v-progress-linear :model-value="e.progresso || 0" height="24" rounded :color="cor" bg-opacity="0.15">
            <strong class="i3d-num">{{ (e.progresso || 0).toFixed(1) }}%</strong>
          </v-progress-linear>
        </div>
      </div>

      <div class="i3d-grade">
        <div class="i3d-celula"><span>Decorrido</span><b>{{ dur(e.decorrido) }}</b></div>
        <div class="i3d-celula"><span>Restante</span><b>{{ dur(e.restante) }}</b></div>
        <div class="i3d-celula"><span>Termina às</span><b>{{ hora(e.eta) }}</b></div>
        <div v-if="e.tipo !== 'bambu'" class="i3d-celula"><span>Estimativa do fatiador</span><b>{{ dur(e.estimativaSlicer) }}</b></div>
        <div v-if="e.filamentoAtual" class="i3d-celula"><span>Filamento em uso</span><b><span class="i3d-bolinha" :style="{ background: e.filamentoAtual.cor || '#999' }"></span>{{ e.filamentoAtual.tipo }} · {{ e.filamentoAtual.nome }}</b></div>
        <div class="i3d-celula"><span>Camada</span><b>{{ camada }}</b></div>
        <div v-if="e.tipo !== 'bambu'" class="i3d-celula"><span>Altura Z</span><b>{{ e.posicao ? e.posicao.z.toFixed(2) + ' mm' : '—' }}</b></div>
        <template v-if="e.tipo !== 'bambu'">
        <div class="i3d-celula"><span>Filamento usado</span><b>{{ filamento }}</b></div>
        <div class="i3d-celula"><span>Peso</span><b>{{ peso }}</b></div>
        </template>
        <div class="i3d-celula"><span>Bico</span><b>{{ temp(e.bico) }}</b></div>
        <div class="i3d-celula"><span>Mesa</span><b>{{ temp(e.mesa) }}</b></div>
        <div class="i3d-celula" v-for="s in (e.sensores || [])" :key="s.nome"><span>{{ s.nome }}</span><b>{{ temp(s) }}</b></div>
        <template v-if="e.tipo === 'bambu'">
        <div class="i3d-celula"><span>Velocidade</span><b>{{ e.nivelTexto || '—' }}</b></div>
        <div class="i3d-celula"><span>Ventoinha</span><b>{{ e.ventoinha != null ? e.ventoinha + '%' : '—' }}</b></div>
        <div class="i3d-celula"><span>Wi-Fi</span><b>{{ e.wifi || '—' }}</b></div>
        </template>
        <template v-else>
        <div class="i3d-celula"><span>Velocidade real</span><b>{{ e.velocidadeAtual != null ? e.velocidadeAtual.toFixed(0) + ' mm/s' : '—' }}</b></div>
        <div class="i3d-celula"><span>Vazão</span><b>{{ e.vazao != null ? e.vazao.toFixed(1) + ' mm³/s' : '—' }}</b></div>
        <div class="i3d-celula"><span>Ventoinha</span><b>{{ e.ventoinha != null ? e.ventoinha + '%' : '—' }}</b></div>
        <div class="i3d-celula"><span>Velocidade / fluxo</span><b>{{ e.velocidade != null ? e.velocidade + '% / ' + e.fluxo + '%' : '—' }}</b></div>
        </template>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  data() { return { semMiniatura: false } },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    cor() {
      return ({ imprimindo: 'primary', preparando: 'primary', pausada: 'warning', pausando: 'warning', concluida: 'success', pronta: 'success',
        cancelada: 'grey', cancelando: 'grey', erro: 'error', offline: 'error', desconectada: 'error' })[this.e.estado] || 'grey'
    },
    base() { return window.location.pathname.replace(/\/[^/]*\/[^/]*\/?$/, '/') },
    urlMiniatura() { return this.base + 'impressora3d/miniatura?v=' + encodeURIComponent(this.e.miniatura) },
    camada() {
      if (this.e.camada == null) return '—'
      return this.e.camada + (this.e.camadas ? ' / ' + this.e.camadas : '')
    },
    filamento() {
      const f = this.e.filamento
      if (!f || f.usado == null) return '—'
      return (f.usado / 1000).toFixed(2) + (f.total ? ' / ' + (f.total / 1000).toFixed(2) : '') + ' m'
    },
    peso() {
      const f = this.e.filamento
      if (!f || !f.peso) return '—'
      return (f.pesoUsado != null ? f.pesoUsado.toFixed(1) + ' / ' : '') + f.peso.toFixed(1) + ' g'
    }
  },
  watch: { 'e.miniatura'() { this.semMiniatura = false } },
  methods: {
    dur(s) {
      if (s == null || !isFinite(s)) return '—'
      s = Math.max(0, Math.round(s))
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
      return h ? h + 'h ' + String(m).padStart(2, '0') + 'min' : (m ? m + 'min ' + String(x).padStart(2, '0') + 's' : x + 's')
    },
    hora(t, seg) {
      if (!t) return '—'
      const d = new Date(t)
      const hoje = new Date().toDateString() === d.toDateString()
      const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: seg ? '2-digit' : undefined })
      return hoje ? h : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + h
    },
    temp(h) {
      if (!h || h.atual == null) return '—'
      return h.atual.toFixed(1) + '°' + (h.alvo ? ' / ' + h.alvo + '°' : '')
    }
  }
}
</script>

<style>
.i3d-job { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
.i3d-mini { width: 72px; height: 72px; object-fit: contain; border-radius: 6px; background: rgba(var(--v-theme-on-surface), .05); flex: none; }
.i3d-job-info { flex: 1; min-width: 0; }
.i3d-bolinha { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; border: 1px solid rgba(0,0,0,.2); }
.i3d-arquivo { font-weight: 600; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
