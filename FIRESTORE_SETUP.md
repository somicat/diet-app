# Firestore 보안 규칙 배포

클라우드 백업 시 `missing or insufficient permissions` 오류가 나면, 아래 규칙을 Firebase에 적용해야 합니다.

## 방법 1: Firebase 콘솔 (권장)

1. [Firebase Console](https://console.firebase.google.com/) → 프로젝트 **diet-app-94875**
2. **Firestore Database** → **규칙(Rules)** 탭
3. `firestore.rules` 파일 내용을 전체 복사해 붙여넣기
4. **게시(Publish)**

## 방법 2: Firebase CLI

```bash
cd /Users/yeojun/Downloads/diet-app
firebase login
firebase deploy --only firestore:rules --project diet-app-94875
```

규칙 적용 후 앱에서 **클라우드 백업**을 다시 시도하세요.
