import React, { useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;



function App() {
  const [sseMessage, setSseMessage] = useState('');
  const [isInfoButtonEnabled, setIsInfoButtonEnabled] = useState(false);
  const [popup, setPopup] = useState(null);




  useEffect(() => {
    
    // axios.defaults.withCredentials = true;

    // Call the /register API to establish SSE connection
    // axios.get('https://app.plurality.local/oauth-twitter/register')
    //   .then(response => {
    //     console.log('Session registered:', response.data);
    //     setupSSE();
    //   })
    //   .catch(error => {
    //     console.error('Error registering session:', error);
    //   });
  }, []);

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

      // Enable the button if the message is "received"
      if (JSON.parse(event?.data)?.message ==="received") {
        console.log("Innnnnnn received")
       
        if (popup) {
          popup.close();
          setPopup(null);
          console.log('Window closed.');
        } else {
          console.log('No window to close or window already closed.');
        }

        setIsInfoButtonEnabled(true);
      }
    };

    evtSource.onerror = function (err) {
      console.error('EventSource failed:', err);
      evtSource.close();
    };
  };

  const handleOAuth = () => {
    const oauthWindow = window.open('https://app.plurality.local:5000/oauth-instagram?isWidget=true&origin=false&apps=false', 'oauth', 'width=500,height=600');
    if (oauthWindow) {
      setPopup(oauthWindow);
      console.log('Window opened:', oauthWindow);
    } else {
      console.error('Failed to open window. It might be blocked by a popup blocker.');
    }
   
   
  };

  // useEffect(() => {
  //   const checkPopup = setInterval(() => {
  //     if (popup && popup.closed) {
  //       console.log('Popup closed');
  //       setPopup(null);
  //       clearInterval(checkPopup);
  //     }
  //   }, 1000);

  //   return () => clearInterval(checkPopup);
  // }, [popup]);

  const handleInfoRequest = () => {
    axios.get('https://app.plurality.local:5000/oauth-instagram/info')
      .then(response => {
        console.log('Info:', response.data);
      })
      .catch(error => {
        console.error('Error getting info:', error);
      });
  };

  return (
    <div className="App">
      <h1>SSE and OAuth Example</h1>
      <button onClick={handleOAuth}>Start OAuth</button>
      <button onClick={handleInfoRequest} disabled={!isInfoButtonEnabled}>Get Info</button>
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
