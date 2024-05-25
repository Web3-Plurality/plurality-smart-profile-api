# Plurality Backend API

Backend API to support dashboard and widget workflows

## How to run

1. Install dependencies

```
npm install
```

2. Run

```
npm run start
```
### Set Local DNS in Windows
1. In Windows 10, we need to open Notepad as admin from start menu (by right clicking) -> then open the c:\Windows\System32\Drivers\etc\hosts -> Add local dns config at end
As per later env it should be
```
# Plurality Network Backend API
127.0.0.1 app.plurality.local
# End of section
```

### Set Local DNS in Linux
1. Use a text editor like nano to edit the /etc/hosts file:
```sudo nano /etc/hosts```
2. Find the line that starts with 127.0.0.1 and modify it as follows:
```127.0.0.1 app.plurality.local```
