import express, { Request, Response } from "express";
const axios = require('axios');

export const subgraphRouter = express.Router();


// POST 
subgraphRouter.post("/", async (req: Request, res: Response) => {
    try {

        const commitments = JSON.stringify(req.body);
        console.log(commitments);
        let data = JSON.stringify({
        "query": `{interestsMetaDatas(where:{commitment_in:${commitments}}){id commitment interests}}`
        });

        let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.studio.thegraph.com/query/43869/plurality-social-interests/version/latest',   //todo: put in .env file
        headers: { 
            'Content-Type': 'application/json', 
        },
        data : data
        };

        axios.request(config)
        .then((response: any) => {
            console.log("Sending response back"+ JSON.stringify(response.data));
            res.status(200).send(JSON.stringify(response.data));
        })
        .catch((error: any) => {
            console.log(error);
            res.status(500).send(error).json();
        });


	} catch (e) {
        res.status(500).send(e).json();
	}
  });