import axios from 'axios';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';


function Test() {
    const [searchParams] = useSearchParams();
    const accessTokenID = searchParams.get('accessTokenID');



    useEffect(() => {
        if (accessTokenID) {
            
            const sseUUID = localStorage.getItem('sseUUID');
   console.log("accessTokenID",accessTokenID)
   console.log("sseUUID",sseUUID)

        axios.post('https://app.plurality.local/oauth-roblox/send-event',{sseUUID:sseUUID, accessTokenUUID: accessTokenID})
        .then(response => {
          console.log('Info:', response.data);
        })
        .catch(error => {
          console.error('Error getting info:', error);
        });
    }
    },[accessTokenID]);

        
    return (  <>
    accessTokenID:
    {accessTokenID}
    </>);
}

export default Test;