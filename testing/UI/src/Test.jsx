import axios from 'axios';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';


function Test() {
    const [searchParams] = useSearchParams();
    const accessTokenID = searchParams.get('token_id');



    useEffect(() => {
        if (accessTokenID) {
        
        console.log(accessTokenID)
        console.log(localStorage.getItem('sseUUID')) 
        axios.post('https://app.plurality.local/oauth-facebook/event',{},{
            headers: {
            'X-Sse-ID': localStorage.getItem('sseUUID'),
            'X-Token-ID':accessTokenID
          }})
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