const soap = require("soap");
const fs = require("node:fs");
const http = require("http");

const postgres = require("postgres");

require('dotenv').config();

const sql = postgres({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});
// Implémentation des services
const service = {
    ProductsService: {
        ProductsPort: {
            CreateProduct: async function ({ name, about, price }, callback) {
                if (!name || !about || !price) {
                throw {
                    Fault: {
                    Code: {
                        Value: "soap:Sender",
                        Subcode: { value: "rpc:BadArguments" },
                    },
                    Reason: { Text: "Processing Error" },
                    statusCode: 400,
                    },
                };
                }
        
                const product = await sql`
                INSERT INTO products (name, about, price)
                VALUES (${name}, ${about}, ${price})
                RETURNING *
                `;
        
                // Will return only one element.
                callback(product[0]);
            },
        },
    },
};

// Exemple de server HTTP
const server = http.createServer(function(request, response){
    response.end("404: Not Found: " + request.url);
});

// Création du SOAP Server
const xml = fs.readFileSync("productsService.wsdl", "utf8");
soap.listen(server, "/products", service, xml, function() {
    console.log("SOAP server running at http://localhost:8000/products?wsdl");
});

server.listen(8000);
