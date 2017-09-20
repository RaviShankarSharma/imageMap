How to setup local development environment
========================

- Install Nodejs version 3.X or more
- Make sure you can run following command
```
npm --version
```
- Install bower, gulp and karma globally using following command
```
npm install -g bower gulp karma
```
- Go to **app** folder
- Open **runconfig.json**

You may use different environments **(LOCAL/DEV/QA/PERF)** for the UI app by setting the value of **useGatewayEnv** property. When you change the value of this property, that means you are using all microservices and all UI apps from that environment except this UI app itself. 
It is recommended to use **DEV** environment as default and do not checkin runconfig.json.

You may change value of **usePort** based on available ports in your machine. This port is being used by node server to run the UI app locally.

**authHeaders** includes header information that is required to login to the system. You are suppose to get the authorization & roles based on the **authHeaders** property.

- Open **app** folder from command line and Run 
```
npm install
```
this will install all required node modules defined in the **package.json**. It is expected that in **package.json > scripts.postinstall** has **bower install** command and that will install all required bower components, otherwise you need to run following command manually from command line.
```
bower install
```

How to run the UI app locally
-----------------------------
- Go to **app** folder from command line
- Run **gulp default** OR **gulp watch**. This generate distributable code in **dist** folder. Use gulp watch to continue development. This will watch for any source code change and generate distributable code runtime.
- Run **gulp serve** to run the node server.
- Now open the browser and try to access **http://localhost:8764** or change the port based on runconfig.json

In case if you face any issue, mailto:  [Saikat Karmakar](mailto://saikat.karmakar@staples.com) OR  [Sandeep Allampalli](mailto://Sandeep.Allampalli@Staples.com)