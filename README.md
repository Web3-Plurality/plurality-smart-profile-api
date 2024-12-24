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


  attestationSchemaScore(): MerkleValue[] {
    const merkleScore : MerkleValue[] =  this.scores.map((s, i) => {
      // Generate random bytes
      const salt = ethers.hexlify(ethers.randomBytes(32));
      return ({ name: `score${1}`, value: JSON.stringify(s), type: 'string'})
    })

    return merkleScore
  }

  attestationSchemaConnectedProfiles(): MerkleValueWithSalt[] {
    return this.connectedProfiles.map((p, i) => {
      // Generate random bytes
      const salt = ethers.hexlify(ethers.randomBytes(32));
      return ({ name: p.platformName, value: JSON.stringify({...p,salt}), type: 'string', salt: salt })
    })
  }

  attestationSchemaGroup(): MerkleValueWithSalt[] {
    const salt1 = ethers.hexlify(ethers.randomBytes(32));
    const salt2 = ethers.hexlify(ethers.randomBytes(32));
    const salt3 = ethers.hexlify(ethers.randomBytes(32));
    const salt4= ethers.hexlify(ethers.randomBytes(32));

    return [
      { name: 'interests', value: JSON.stringify({"interests" : this.interests,salt: salt1}), type: 'string', salt: salt1 },
      { name: 'reputationTags', value: JSON.stringify({'reputationTags': this.reputationTags, salt: salt2}), type: 'string', salt: salt2 },
      { name: 'badges', value: JSON.stringify({'badges' : this.badges, salt:salt3}), type: 'string', salt: salt3 },
      { name: 'collections', value: JSON.stringify({ 'collections': this.collections, salt:salt4}), type: 'string', salt: salt4 },
    ];
  }
