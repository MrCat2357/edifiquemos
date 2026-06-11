# Comandos úteis

## Geração de áudio TTS

### Gerar áudios pendentes — Staging
```powershell
node scripts/generate-all-audio.cjs
```

### Gerar áudios pendentes — Produção
```powershell
$env:NODE_ENV="production"; node scripts/generate-all-audio.cjs
```

### Resetar post travado em "generating"
No Firebase Console → Firestore → `posts` → encontre o post → 
edite `audioStatus` de `"generating"` para `"none"`.

## Desenvolvimento

### Rodar em modo dev
```powershell
npm run dev
```