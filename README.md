<!-- <p align="center">
  <a href="" rel="noopener">
 <img width=400px height=210px src="https://imgur.com/a/m0b4ZIL.png" alt="Project logo"></a>
</p>  -->

<h3 align="center">Week-jump-Dashboard-server</h3>
<p align="center">https://dylantsouy.github.io/week-jump-dashboard/#/login
</p>


---

## 📝 Table of Contents

- [About](#about)
- [Getting Started](#getting_started)
- [Usage](#usage)
- [Deployment](#deployment)
- [Built Using](#built_using)
- [Authors](#authors)
- [Acknowledgments](#acknowledgement)

## 🧐 About <a name = "about"></a>

 This is the Week-Jump-Dashboard api, This is just a project. If you need more information, Please feel free to contact me at any time

## 🏁 Getting Started <a name = "getting_started"></a>






### Installing

In the project directory, you can run:

```
npm i
```

Install the necessary package for project before start.

```
npm run db:reset
```

You can simply run this script to reset DB or follow below to run seperately


```
npx sequelize-cli db:create
```

Sequelize CLI to create the database form config/config.json, and don't forget to edit db config before create

```
npx sequelize-cli db:migrate
```

Automatically creates both a model file and a migration with the attributes we’ve specified

```
npx sequelize-cli db:seed:all
```

run both seed files to add our fake data to the database

```
npm run dev
```

Open [http://localhost:3000/api/](http://localhost:3000/api/) to connect it.

The api will reload if you make edits by using nodemon.

## 🎈 Usage <a name="usage"></a>
In the project directory, you can run:

```
npx sequelize-cli db:drop
```

If you want to clear the db and migrations

```
npx sequelize-cli model:generate --name User --attributes email:string,password:string
```

If you want to generate model

```
npx sequelize-cli seed:generate --name users
```

If you want to generate seed

## 🚀 Deployment <a name = "deployment"></a>

Frontend Deploy By github page
https://pages.github.com/

API Deploy By Render
https://render.com/

## ⛏️ Built Using <a name = "built_using"></a>

- [Mysql](https://www.mysql.com/) - Database
- [NodeJs](https://nodejs.org/en/) - Server Environment
- [Express](https://expressjs.com/) - Server Framework
- [Sequelize](https://sequelize.org/) - Node.js ORM
- [Render](https://render.com/) - Clould

## ✍️ Authors <a name = "authors"></a>

- [@Dylan Tsou](https://github.com/dylantsouy) 

## 🎉 Acknowledgements <a name = "acknowledgement"></a>

- Hat tip to anyone whose code was used
- Inspiration
- References
