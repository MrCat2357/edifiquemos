# Comandos úteis

## Verificação e geração de áudio TTS

### Verificar áudios desatualizados (stale) — Staging
```powershell
node scripts/check-stale-audio.cjs
```

### Verificar áudios desatualizados (stale) — Produção
```powershell
$env:NODE_ENV="production"; node scripts/check-stale-audio.cjs
```

> Varre todos os posts com `audioStatus "ready"`, recalcula o hash SHA-256
> do conteúdo atual e marca como `"stale"` os que estão desatualizados.
> Não gera áudio — apenas marca.

### Gerar áudios pendentes — Staging
```powershell
node scripts/generate-all-audio.cjs
```

### Gerar áudios pendentes — Produção
```powershell
$env:NODE_ENV="production"; node scripts/generate-all-audio.cjs
```

### Corrigir backlog completo (sequência recomendada)
```powershell
# Staging
node scripts/check-stale-audio.cjs
node scripts/generate-all-audio.cjs

# Produção
$env:NODE_ENV="production"; node scripts/check-stale-audio.cjs
$env:NODE_ENV="production"; node scripts/generate-all-audio.cjs
```

> `check-stale-audio` marca os desatualizados; `generate-all-audio` pega
> tudo que não está `"ready"` ou `"generating"` e gera o áudio.
> Rodar os dois em sequência resolve qualquer backlog.

### Resetar post travado em "generating"
No Firebase Console → Firestore → `posts` → encontre o post →
edite `audioStatus` de `"generating"` para `"none"`.

---

## Correção de autorFoto em reflexões antigas

### Corrigir reflexões sem foto — Staging
```powershell
node scripts/fix-reflexao-autor-foto.cjs
```

### Corrigir reflexões sem foto — Produção
```powershell
$env:NODE_ENV="production"; node scripts/fix-reflexao-autor-foto.cjs
```

> Rode **uma única vez** após o deploy. Novas reflexões já são criadas com
> `autorFoto` pelo `route.ts` corrigido. Após rodar, execute
> `generate-all-audio.cjs` para regenerar o áudio das reflexões corrigidas.

---

## Desenvolvimento

### Rodar em modo dev
```powershell
npm run dev
```