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


## Desenvolvimento

### Rodar em modo dev
```powershell
npm run dev
```