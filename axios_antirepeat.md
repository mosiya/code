## From《如何防止重复发送ajax请求》：https://mp.weixin.qq.com/s/O2zfoLk7eG1ZGQTAj_DeGA

### 请求拦截和请求取消

作为一个成熟的ajax应用，它应该能自己在pending过程中选择请求拦截和请求取消

+ 请求拦截
  1. 用一个数组存储目前处理pending状态的请求
  2. 发送请求前先判断这个api请求之前是否已经有还在pending的同类，即是否存在上述数组中
  3. 若存在，则不发送请求
     否则，就正常发送请求将该api添加到数组中
  4. 等请求完结后删除数组中的这个api

+ 请求取消
  1. 用一个数组存储目前处于pending状态的请求
  2. 发送请求时判断这个api请求之前是否已经有还在pending的同类，即是否存在上述数组中
  3. 若存在，则找到数组中pending状态的请求并取消
     否则就将该api添加到数组中
  4. 发送请求
  5. 等请求完结后删除数组中的这个api

### 实现

#### 官网的其中一个示例

通过axios的cancel token，可以轻松做到请求拦截和请求取消

```js
const CancelToken = axios.CancelToken
const source = CancelToken.source()

axios.get('/user/12345', {
    cancelToken: source.token
}).catch(thrown => {
    if(axios.isCancel(thrown) {
        console.log('Request canceled', thrown.message)
    } else {
        // handle error
    })
})

axios.post('/user/12345', {
    name: 'new name'
}, {
    canceToken: source.token
})

// cancel the request (the message parameter is optional)
source.cancel('Operation canceled by the user.')
```

官网示例中，先定义了一个const CancelToken = axios.CancelToken，定义可以在axios源码axios/lib/axios.js目录下找到

```js
// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel')
axios.CancelToken = require('./cancel/CancelToken')
axios.isCancel = require('./cancel/isCancel')
```

示例中调用了axios.CancelToken的source方法，可以在axios/lib/cancel/CancelToken.js目录下看到source方法

```js
/*
 * Returns an object that contains a  new 'CancelToken' and a function that, when called,
 * cancels the 'CancelToken'
 */
CancelToken.source = function source() {
    let cancel
    let token = new CancelToken(function executor(c) {
        cancel = c
    })
    return  {
        token,
        cancel
    }
}
```

source方法返回一个具有token和cancel属性的对象，这两个属性都喝CancelToken构造函数有关联，所以接下来看卡CancelToken构造函数

```js
/*
 * A 'CancelToken' is an Object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function 
 */
function CancelToken(executor) {
    if(typeof executor !== 'function') {
        throw new TypeError('executor must be a function.')
    }

    var resolvePromise
    this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve
    })

    var token = this
    executor(function cancel(message) {
        if(token.reason) {
            // Cancellation has already been requested
            return
        }

        token.reason = new Cancel(message)
        resolvePromise(token.reason)
    })
}
```

所以source.token是一个CancelToken的实例，而source.cancel是一个函数，调用它会在CancelToken的实例上添加一个reason属性，并且将实例上的promise状态resolve掉

#### 官网的另一个示例

```js
const CancelToken = axios.CancelToken
let cancel

axios.get('/user/12345', {
    cancelToken: new CancelToken(function executor(c) {
        // An executor function receives a camcel function as a parameter
        cancel = c
    })
})

// cancel the request
cancel()
```

它与第一个示例的区别就在于每个请求都会创建一个CancelToken实例，从而它拥有多个cancel函数来执行取消操作

我们执行axios.get，最后其实就是执行axios实例上的request方法，方法定义在axios/lib/core/Axios.js

```js
Axios.prototype.request = function request(config) {
    ...
    // Hook up interceptors middleware
    var chain = [disparchRequest, undefined]
    var promise = Promise.resolve(config)

    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        chain.unshift(interceptor.fulfilled, interceptor.rejected)
    })

    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        chain.push(interceptor.fulfilled, interceptor.rejected)
    })

    while(chain.length) {
        promise = promise.then(chain.shift(), chain.shift())
    }

    return promise
}
```

request方法返回一个链式调用的promise，等同于

```js
Promise.resolve(config).then('request拦截器中的resolve方法', 'request拦截器中的rejected方法').then(dispatchRequest, undefined).then('request拦截器中的resolve方法', 'request拦截器中的rejected方法')
```

__在阅读源码的过程中，这些变成小技巧都是非常值得学习的__

接下来看看axios/lib/core/dispatchRequest.js中的dispatchRequest方法

```js
function throwIfCancellationRequested(config) {
    if(config.cancelToken) {
        config.cancelToken.throwIfRequest()
    }
}
module.exports = function dispatchRequest(config) {
    throwIfCancellationRequested(config)
    ...
    var adapter = config.adapter || default.adapter
    return adapter(config).then()
}
```

如果是cancel方法立即执行，创建了CancelToken实例上的reason属性，那么就会抛出异常，从而被response拦截器中的rejected方法捕获，并不会发送请求，这个可以用来做请求拦截

```js
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
    if(this.reason) {
        throw this.reason
    }
}
```

如果cancel方法延迟执行，那么接着去找axios/lib/defaults.js中的defaults.adapter

```js
function getDefaultAdapter() {
    var adapter
    if(typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = require('./adapter/xhr')
    } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = require('./apters/http')
    }
    return adapter
}

var defaults = {
    adapter: getDefaultAdapter()
}
```

终于找到axios/lib/adapters/xhr.js中xhrAdapter

```js
module.exports = function xrhAdapter(config) {
    return new Promise(function dispatchXhrRequest(resolve, reject) {
        ...
        var request = new XMLHttpRequest()
        if(config.cancelToken) {
            // Handle cancellation
            config.cancelToken.promise.then(function onCanceled(cancel) {
                if(!request) {
                    return
                }

                request.abort()
                reject(cancel)
                // Clean up request
                request = null
            })
        }
        // Send the request
        request.send(requestData)
    })
}
```

可以看到xhrAdapter创建了XMLHttpRequest对象，发送ajax请求，在这之后如果执行cancel函数将CancelToken.promise状态resolve掉，就会调用request.abort()，可以用来请求取消

#### 解耦

剩下要做的就是将CancelToken从业务代码中剥离出来。

axios库二次封装，常见的做法是在response拦截器里统一处理返回code

##### 请求取消demo

```js
let pendingAjax = []
const fastClickMsg = '数据请求中，请稍后'
const CancelToken = axios.CancelToken
const removePendingAjax = (url, type) => {
    const index = pendingAjax.findIndex(i => i.url === url)
    if(index > -1) {
        type === 'req' && pendingAjax[index].c(fastClickMsg)
        pendingAjax.splice(index, 1)
    }
}

// Add a request interceptor
axios.interceptors.request.use(
    function (config) {
        // Do shmething before request is sent
        const url = config.url
        removePendingAjax(url, 'req')
        config.cancelToken = new CancelToken(c => {
            pendingAjax.push({
                url,
                c
            })
        })
        return config
    },
    function (error) {
        // Do something with request error
        return Promise.reject(error)
    }
)

// Add a response interceptor
axios.interceptors.response.use(
    function (response) {
        // Any status code that lie within the range of 2xx cause this function to trigger
        // Do something with response data
        removePendingAjax(response.config.url, 'resp')
        return new Promise((resolve, reject) => {
            if(+response.data.code !== 0) {
                reject(new Error('network error:' + response.data.msg))
            } else {
                resolve(response)
            }
        })
    },
    function (error) {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        // Do something with response error
        Message.error(error)
        return Promise.reject(error)
    }
)
```

每次执行request拦截器（也就是每次都取消前一个同样的请求）

1. 判断pendingAjax数组中是否还存在同样的url
2. 若存在，则删除数组中的这个api，并且在执行数组中在pending的ajax请求的cancel函数进行请求取消
3. 正常发送第二次的ajax请求并且将该api添加到数组中
4. 等请求完结后删除数组中的这个api

##### 请求拦截demo

```js
let pendingAjax = []
const fastClickMsg = '数据请求中，请稍后'
const CancelToken = axios.CancelToken
const removePendingAjax = (config, c) => {
    const url  = config.url
    const index = pendingAjax.findIndex(i => i === url)
    if(index > -1) {
        c ? c(fastClickMsg) : pendingAjax.splice(index, 1)
    } else {
        c && pendingAjax.push(url)
    }
}

// Add a request interceptor
axios.interceptor.request.use(
    function (config) {
        // Do somthing before request is sent
        config.cancelToken = new CancelToken(c => {
            removePendingAjax(config, c)
        })
        return config
    },
    function (error) {
        // Do something with request error
        return Promise.reject(error)
    }
)

// Add a response interceptor
axios.interceptors.response.use(
    function (response) {
        // Any status code that lie within the range of 2xx cause this function to trigger
        // Do something with response data
        removePendingAjax(response.config)
        return new Promise((resolve, reject) => {
            if(+response.data.code !== 0) {
                reject(new Error('network error:' + response.data.msg))
            } else {
                resolve(response)
            }
        })
    },
    function (error) {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        // Do something with response error
        Message.error(error)
        return Promise.reject(error)
    }
)
```

每次执行request拦截器（每次都取消自己的重复请求）

1. 判断pendingAjax数组中是否还存在同样的url
  + 若存在，则执行自身的cancel函数进行请求拦截，不重复发送请求
  + 否则就正常发送并且将该api添加到数组中
2. 等请求完结后删除数组中的这个api


### 最后

axios是基于XMLHttpRequest的封装，针对fetch也有类似的解决方法AbortSignal