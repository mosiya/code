## From《解析vue2.0的diff算法》：https://github.com/aooy/blog/issues/2

### 理解virtual dom

+ 创建和操作dom是耗费性能的事情
```js
// 打印一个空元素的第一层属性 ，就有200多个
var mydiv = document.createElement('div');
for(var k in mydiv ){
  console.log(k)
}
```
+ js对象的运算比操作dom更简单，速度快很多
+ virtual dom是用一个简单的js对象去代表真实的dom对象
+ 当dom发生改变时，先对比virtual dom的变动，最后再将改变应用到真实的dom上

### 分析diff算法

当新旧两个dom发生变化时，如果每个新的dom节点都和每个旧的dom节点进行对比，会很耗时。
考虑到跨级移动dom的情况较少发生，于是将diff算法简化为只在同层级进行比较，不比较跨层级的变动，于是性能有了巨大的提升

+ patch函数
```js
function patch(oldVnode, vnode) {
    if(sameVnode(oldVnode, vnode)) {
        patchVnode(oldVnode, vnode)
    } else {
        const oEl = oldVnode.el
        let parentEle = api.parentNode(oEl)
        createEle(vnode)
        if(parentEle !== null) {
            api.insertBefore(parentEle, vnode.el, api.nextSibling(oEl))
            api.removeChild(parentEle, oldVnode.el)
            oldVnode = null
        }
    }
    return vnode
}
```

+ 完整的vnode拥有的属性
```js
// body下的<div id="v" class="classA"></div>对应的oldVnode就是
{
    el: div, // 对真实节点的引用，本例中就是document.querySelector('#id.classA)
    tagName: 'DIV', // 节点的表情
    sel: 'div#v.classA', // 节点的选择器
    data: null, // 一个存储节点属性的对象，对应节点的el[prop]属性，例如onclick，style
    children: [], // 存储子节点的数组，每个字节点也是vnode结构
    text: null // 如果是文本节点，对应文本节点的textContent，否则为null
}
```

+ sameVnode函数：看两个节点是否值得比较
```js
function sameVnode(oldVnode, vnode) {
    return vnode.key === oldVnode.key && vnode.sel === oldVnode.sel
}
```
+ 不值得比较的两个节点。会进行如下比较：
  + 取得oldVnode.el的父节点，parentEle是真实dom
  + createEle(vnode)会为vnode创建它的真实dom，令vnode.el = 真实dom
  + parentEle将新的dom插入，移除旧的dom

也就是说：当不值得比较时，新节点直接把老节点整个替换了

+ 最后返回vnode

vnode唯一的改变就是之前vnode.el = null，而现在它引用的是对应的真实dom

+ 执行以下，完成一个patch过程
```js
var oldVnode = patch(oldVnode, vnode)
```


#### 理解patchVnode

+ 当两个节点值得比较时，调用patchVnode函数
```js
function patchVnode(oldVnode,vnode) {
    const el = vnode.el = oldvnode.el
    let i, oldCh = oldVnode.children, ch vnode.children
    if(oldVnode === vnode) return
    if(oldVnode.text !== null && vnode.text !== null && oldVnode.text !== vnode.text) {
        api.setTextContent(el, vnode.text)
    } else {
        updateEle(el, vnode, oldVnode)
        if(oldCh && ch && oldCh !== ch) {
            updateChildren(el, oldCh, ch)
        } else if(ch) {
            createEle(vnode) // create el's children dom
        } else if(oldCh) {
            api.removeChidren(el)
        }
    }
}
```
const el = vnode.el = oldVnode.el 是很重要的一步，让vnode.el引用到现在的真实dom，当el修改时，vnode.el会同步变化

节点的比较有5种情况：

1. if(oldVnode === vnode)，它们的引用一致，可以认为没有变化
2. if(oldVnode.text !== null && vnode.text !== null && oldVnode.text !== vnode.text)，文本节点的比较，需要修改，则会调用 Node.textContent = vnode.text
3. if(oldCh && ch && oldCh !== ch)，两个节点都有子节点，而且它们不一样，这样我们会调用updateChildren函数比较子节点，这是diff的核心
4. else if(ch)，只有新的节点有子节点，调用createEle(vnode)，vnode.el已经引用了老的dom节点，createEle函数会在老dom节点上添加子节点
5. else if(oldCh)，新节点没有子节点，老节点有子节点，直接删除老节点

#### 核心：updateChildren

```js
function updateChildren(parentElm, oldCh, newCh) {
    let oldStartIdx = 0, newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx
    let idxInOld
    let elmToMove
    let before

    while(oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if(oldStartVnode == null) {
            oldStartVnode = oldCh[++oldStartIdx]
        } else if(oldEndVnode == null) {
            oldEndVnode = oldCh[--oldEndIdx]
        } else if(newStartVnode == null) {
            newStartVnode = newCh[++newEndIdx]
        } else if(newEndVnode == null) {
            newEndVnode = newCh[--newEndIdx]
        } else if(sameVnode(oldStartVnode, newStartVnode)) {
            patchVnode(oldStartVnode, newStartVnode)
            oldStartVnode = oldCh[++oldStartIdx]
            newStartVnode = newCh[++newStartIdx]
        } else if(sameVnode(oldEndVnode, newEndVnode)) {
            patchVnode(oldEndVnode, newEndVnode)
            oldEndVnode = oldCh[--oldEndIdx]
            newEndVnode = newCh[--newEndIdx]
        } else if(sameVnode(oldStartVnode, newEndVnode)) {
            patchVnode(oldStartVnode, newEndVnode)
            api.insertBefore(parentElm, oldStartVnode.el, api.nextSibling(oldEndVnode.el))
            oldStartVnode = oldCh[++oldStartIdx]
            newEndVnode = newCh[--newEndIdx]
        } else if(sameVnode(oldEndVnode, newStartVnode)) {
            patchVnode(oldEndVnode, newStartVnode)
            api.insertBefore(parentElm, oldEndVnode.el, oldStartVnode.el)
            oldEndVnode = oldCh[--oldEndIdx]
            newStartVnode = newCh[++newStartIdx]
        } else {
            // 使用key时的比较
            if(oldKeyToIdx === undefined) {
                oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldENdIdx) // 有key生成index表
            }
            idxIndOld = oldKeyToIdx[newStartVnode.key]
            if(!idxInOld) {
                api.insertBefore(parentElm, createEle(newStartVnode).el, oldStartVnode.el)
                newStartVnode = newCh[++newStartIdx]
            } else {
                elmToMove = oldCh[idxInOld]
                if(elmToMove.sel !== newStartVnode.sel) {
                    api.insertBefore(parentElm, createEle(newStartVnode).el, oldStartVnode.el)
                } else {
                    patchVnode(elmToMove, newStartVnode)
                    oldCh[idxInOld] = null
                    api.insertBfore(parentElm, elmTomove.el, oldStartVnode,el)
                }
                newStartVnode = newCh[++newStartIdx]
            }
        }
    }

    if(oldStartIdx > oldEndIdx) {
        before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].el
        addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx)
    } else if(newStartIdx > newEndIdx) {
        removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
    }
}
```

##### 具体的diff分析

+ 设置key和不设置key的区别：
__不设key，newCh和oldCh只会进行头尾两端的相互比较，设key后，除了头尾两端的比较外，还会从用key生成的对象oldKeyToIdx中查找匹配的节点，所以为节点设置key可以更搞笑地利用dom__
+ 针对sameVnode(oldStartVnode, newStartVnode)和sameVnode(oldEndVnode, newEndVnode)为true的情况，不需要对dom进行移动
+ 总结遍历过程，有3种dom操作
  1. 当oldStartVnode和newEndVnode值得比较，说明oldStartVnode.el跑到oldEndVnode.el的后边了
  2. 当oldEndVnode和newStartVnode值得比较，说明oldEndVnode.el需要移动到oldStartVnode.el前边
  3. newCh中的解答在oldCh里没有，则将新节点插入到oldStartVnode.el前边

+ 在结束时，分为两种情况：
  1. oldStartIdx > oldEndIdx: 可以认为oldCh先遍历完，当然也有可能newCh此时也正好完成了遍历，统一都归为此类，此时newStartIdx和newEndIdx之间的vnode是新增的，调用addVnodes把它们全部插入before后边。
  2. newStartIdx > newEndIdx: 可以认为newCh先遍历完，此时oldStartIdx和oldEndIdx之间的vnode在新的子节点里已经不存在了，调用removeVnodes将它们从do里删除

### 总结

+ 尽量不要跨层级地修改dom
+ 设置key可以最大化地利用节点
+ diff的效率并不是每种情况下都是最优的