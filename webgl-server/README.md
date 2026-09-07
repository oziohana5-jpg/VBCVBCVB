# 🎮 WebGL Server — thejews.duckdns.org

שרת פשוט להגשת משחק Unity WebGL על הדומיין שלך.

---

## 📋 דרישות מוקדמות

- [Node.js](https://nodejs.org) מותקן על המחשב
- Unity עם תמיכה ב-WebGL Build Support
- הפורט 80 פתוח בראוטר (Port Forwarding)

---

## 🔨 שלב 1 — בנה WebGL ב-Unity

1. פתח את הפרויקט ב-Unity
2. לך ל: **File → Build Settings**
3. בחר **WebGL** מהרשימה
4. לחץ **Switch Platform**
5. לחץ **Player Settings** ← ודא שה-Compression Format הוא **Disabled** או **Gzip**
6. לחץ **Build** ובחר תיקיית יעד כלשהי (למשל `C:\MyBuild`)

---

## 📁 שלב 2 — הכנס את ה-Build לשרת

העתק את **כל התוכן** של תיקיית ה-Build אל תוך:

```
webgl-server/public/
```

המבנה צריך להיראות כך:

```
webgl-server/
├── public/
│   ├── index.html
│   ├── Build/
│   │   ├── game.wasm.gz (או .br)
│   │   ├── game.js.gz
│   │   └── ...
│   └── TemplateData/
├── server.js
├── package.json
└── README.md
```

---

## ⚙️ שלב 3 — התקן את השרת

פתח PowerShell בתיקיית `webgl-server` והרץ:

```powershell
npm install
```

---

## 🚀 שלב 4 — הפעל את השרת

```powershell
node server.js
```

תראה:
```
✅ Server running at http://thejews.duckdns.org
   Local address: http://localhost:80
```

---

## 🌐 שלב 5 — Port Forwarding בראוטר

כדי שאנשים מחוץ לרשת שלך יגיעו לאתר:

1. היכנס לראוטר שלך (בדרך כלל `http://192.168.1.1`)
2. חפש **Port Forwarding** / **NAT**
3. הוסף חוק חדש:
   - **External Port:** 80
   - **Internal IP:** ה-IP של המחשב שלך ברשת הפנימית (למשל `192.168.1.100`)
   - **Internal Port:** 80
   - **Protocol:** TCP
4. שמור והפעל מחדש את הראוטר

---

## 🔄 עדכון ה-IP ב-DuckDNS (אוטומטי)

ה-IP שלך יכול להשתנות. כדי לעדכן אוטומטית, הרץ את הפקודה הזאת כל כמה דקות (תזמן ב-Task Scheduler):

```powershell
Invoke-WebRequest "https://www.duckdns.org/update?domains=thejews&token=fd1d4730-48fa-4f3c-af31-17000c32d56d&ip=" -UseBasicParsing
```

---

## ✅ בדיקה

פתח דפדפן ולך ל:

```
http://thejews.duckdns.org
```

המשחק אמור להיטען! 🎉

---

## 🛠️ בעיות נפוצות

| בעיה | פתרון |
|------|--------|
| "Cannot GET /" | ודא שיש `index.html` בתוך `public/` |
| המשחק לא נטען | ודא שה-Compression Format ב-Unity תואם לשרת |
| לא נגיש מבחוץ | בדוק את ה-Port Forwarding בראוטר |
| פורט 80 תפוס | שנה `PORT` ל-8080 ב-server.js ועדכן את ה-Port Forwarding |
