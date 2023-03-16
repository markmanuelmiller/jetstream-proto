
# apk add --update --no-cache vim git make musl-dev go curl

apk add --update --no-cache make musl-dev go curl
# Configure Go
export GOPATH=/root/go
export PATH=${GOPATH}/bin:/usr/local/go/bin:$PATH
export GOBIN=$GOROOT/bin
mkdir -p ${GOPATH}/src ${GOPATH}/bin
export GO111MODULE=on
go version


go install github.com/nats-io/natscli/nats@latest


# NATS CLI
nats stream ls

## These are all ephemeral consumers
nats sub --stream [streamName]
nats sub --stream rooms --new
nats sub --stream rooms --last-per-subject rooms.1
nats sub --stream rooms --last
nats sub --stream rooms --start-sequence=900

## Durable consumers - push consumer
nats sub "rooms.>" --durable my_consumer 

## publish
nats pub rooms.1.abc "hello world" --count 10

# list durable consumers - all flag for kv store and object store
nats consumer ls -a

nats consumer info


## create pull consumer
nats consumer create 
- all
- explicit
- instant

## consume messages on pull consumer
nats consumer next rooms pull_consumer --count=10


## kv store
nats kv add mybucket

## history - how many historic values to keep per key

## create a key
nats kv put mybucket mykey myvalue

## get a key
nats kv get mybucket mykey

## delete a key
nats kv del mybucket mykey

# get state of streams
nats stream state

nats stream subjects

nats stream report



## Demo
nats kv list

nats stream list

# postman /init

nats stream list
nats stream state
nats consumer list

# postman /sub-purge

nats kv list

nats kv get kv_rooms [roomId]

nats stream report
nats consumer info