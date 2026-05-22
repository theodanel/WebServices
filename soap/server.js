const soap = require("soap");
const fs = require("node:fs");
const path = require("node:path");
const http = require("http");

const postgres = require("postgres");

require('dotenv').config({ path: path.join(__dirname, "..", ".env") });

const sql = postgres({
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});
function throwBadArguments() {
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

// Implémentation des services
const service = {
    ProductsService: {
        ProductsPort: {
            GetProducts: async function (_, callback) {
                const products = await sql`
                SELECT id, name, about, price
                FROM products
                ORDER BY id
                `;

                callback({
                    Product: products.map((product) => ({
                        id: String(product.id),
                        name: product.name,
                        about: product.about,
                        price: String(product.price),
                    })),
                });
            },

            PatchProduct: async function ({ id, name, about, price }, callback) {
                if (!id) {
                    throwBadArguments();
                }

                if (name === undefined && about === undefined && price === undefined) {
                    throwBadArguments();
                }

                const updatedProducts = await sql`
                UPDATE products
                SET
                    name = COALESCE(${name ?? null}, name),
                    about = COALESCE(${about ?? null}, about),
                    price = COALESCE(${price ?? null}, price)
                WHERE id = ${id}
                RETURNING *
                `;

                if (updatedProducts.length === 0) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:NotFound" },
                            },
                            Reason: { Text: "Product not found" },
                            statusCode: 404,
                        },
                    };
                }

                callback(updatedProducts[0]);
            },

            DeleteProduct: async function ({ id }, callback) {
                if (!id) {
                    throwBadArguments();
                }

                const deletedProducts = await sql`
                DELETE FROM products
                WHERE id = ${id}
                RETURNING id
                `;

                if (deletedProducts.length === 0) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:NotFound" },
                            },
                            Reason: { Text: "Product not found" },
                            statusCode: 404,
                        },
                    };
                }

                callback({ id: String(deletedProducts[0].id) });
            },

            CreateProduct: async function ({ name, about, price }, callback) {
                if (!name || !about || !price) {
                    throwBadArguments();
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
const xml = fs.readFileSync(path.join(__dirname, "productsService.wsdl"), "utf8");
soap.listen(server, "/products", service, xml, function() {
    console.log("SOAP server running at http://localhost:8000/products?wsdl");
});

server.listen(8000);
