import React, { useState, useEffect } from 'react';
import axios from 'axios';


axios.defaults.withCredentials = true;



function App() {
  const [sseMessage, setSseMessage] = useState('');
  const [isInfoButtonEnabled, setIsInfoButtonEnabled] = useState(false);
  const [popup, setPopup] = useState(null);
  const [sseID, setSSEID] = useState("");
  const [tokenID, setTokenID] = useState("null");









// const handle = ()=>{
//   axios.get('http://localhost:5000/register').then((res)=>{
// console.log("register")
// })
// }

const handleAPI = ()=>{
  setupSSE()
}

  const setupSSE = () => {
    const evtSource = new EventSource('https://app.plurality.local/register-event', { withCredentials: true });
    evtSource.onmessage = function (event) {
      console.log('Message from server:', JSON.parse(event?.data)?.message);
      setSseMessage(event.data);
      //set sse id
      setSSEID(JSON.parse(event?.data)?.id);
      // Enable the button if the message is "received"
      if (JSON.parse(event?.data)?.message ==="received") {
        console.log(JSON.parse(event?.data)?.auth)
        //localStorage.setItem('tokenID', JSON.parse(event?.data)?.auth);

        /*if (popup) {
          popup.close();
          setPopup(null);
          console.log('Window closed.');
        } else {
          console.log('No window to close or window already closed.');
        }*/

          axios.get(`${process.env.REACT_APP_OAuth_Endpoint}/info`,{
            headers: {
              'x-token-id': JSON.parse(event?.data)?.auth
            }
          })
            .then(response => {
              console.log('Info:', response.data);
            })
            .catch(error => {
              console.error('Error getting info:', error);
            });

        //setIsInfoButtonEnabled(true);
      }
    };

    evtSource.onerror = function (err) {
      console.error('EventSource failed:', err);
      evtSource.close();
    };
  };

  const handleOAuth = () => {
    localStorage.setItem('sseUUID', sseID);
    const oauthWindow = window.open(`${process.env.REACT_APP_OAuth_Endpoint}?sse_id=${sseID}`, 'oauth', 'width=500,height=600');
    if (oauthWindow) {
      setPopup(oauthWindow);
      console.log('Window opened:', oauthWindow);
    } else {
      console.error('Failed to open window. It might be blocked by a popup blocker.');
    }
   
   
  };


  const handleInfoRequest = () => {
    
  };

  return (
    <div className="App">
      <h1>SSE and OAuth Example</h1>
      <button onClick={handleOAuth}>Start OAuth</button>
      {/*<button onClick={handleInfoRequest} disabled={!isInfoButtonEnabled}>Get Info</button>}
      {/* <button onClick={handle} >register</button> */}
      <button onClick={handleAPI} >register event</button>
      <div>
        <h2>SSE Message:</h2>
        <p>{sseMessage}</p>
      </div>
    </div>
  );
}

export default App;
