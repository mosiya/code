// From 《深入剖析：Vue核心之虚拟DOM》：https://juejin.im/post/6844903895467032589

/**
 * Element virtual - dom 对象定义
 * @param {String} tagName - dom 元素名称
 * @param {Object} props - dom属性
 * @param {Array<Element|String>} - 子节点
 */

function Element(tagName, props, children) {
    this.tagName = tagName
    this.props = props
    this.children = children
    // dom元素的key值，用作唯一标识符
    if(props.key) {
        this.key = props.key
    }
    let count = 0
    children.forEach((child, i) => {
        if(child instanceof Element) {
            count += child.count
        } else {
            children[i] = '' + child
        }
        count++
    })
    // 子元素个数
    this.count = count
}

function createElement(tagName, props, children) {
    return newElement(tagName, props, children)
}

module.exports = createElement
// 举个栗子
let h = createElement
let ul = h('div', { id: 'virtual-dom' }, [
    h('p', {}, ['Virtual DOM']),
    h('ul', { id: 'list' }, [
        h('li', { class: 'item' }, ['Item 1']),
        h('li', { class: 'item' }, ['Item 2']),
        h('li', { class: 'item' }, ['Item 3'])
    ]),
    h('div', {}, ['Hello world'])
])

/**
 * render将virtual-dom对象渲染为实际DOM元素
 */

Element.prototype.render = function() {
    let el = document.createElement(this.tagName)
    let props = this.props
    // 设置节点的DOM属性
    for(let propName in pros) {
        let propValue = props[propName]
        el.setAttribute(propName, propValue)
    }

    let children = this.children || []
    children.forEach(child => {
        let childEl = (child instanceof Element)
        ? child.render() // 如果子节点也是虚拟DOM，递归构建DOM节点
        : document.createTextNode(child) // 如果是字符串，则只构建文本节点
        el.appendChild(childEl)
    })
    return el
}

// 将构建好的DOM结构添加到页面body上
ulRoot = ul.render()
document.body.appendChild(ulRoot)

// diff函数，对比两棵树
function diff(oldTree, newTree) {
    let index = 0 // 当前节点的标志
    let patches = {} // 用来记录每个节点差异的对象
    dfsWalk(oldTree, newTree, index, patches)
    return patches
}

// 对两棵树进行深度优先遍历
function dfsWalk(oldNode, newNode, index ,patches) {
    let currentPatch = []
    if(typeof oldNode === 'string' && typeof newNode === 'string') {
        // 文本内容改变
        if(newNode !== oldNode) {
            currentPatch.push({ type: patch.TEXT, content: newNode })
        }
    } else if(newNode !== null && oldNode.tagName === newNode.tagName && oldNode.key === newNode.key) {
        // 节点相同，比较属性
        let propsPatches = diffProps(oldNode, newNode)
        if(propsPatches) {
            currentPatch.push({ type: patch.PROPS, props: propsPatches })
        }
        // 比较子节点，如果子节点有'ignore'属性，则不需要比较
        if(!isIgnoreChildren(newNode)) {
            diffChildren(
                oldNode.children,
                newNode.children,
                index,
                patches,
                currentPatch
            )
        }
    } else if(newNode !== null) {
        // 新节点和旧节点不同，用replace替换
        currentPatch.push({ type: patch.REPLACE, node: newNode })
    }

    if(currentPatch.length) {
        patches[index] = currentPatch
    }
}

// DOM操作的差异性包括：
// + 节点替换：节点改变 - REPLACE
// + 顺序互换：移动、删除、新增子节点 - REORDER
// + 属性改变：修改了节点的属性 - PROPS
// + 文本改变：改变文本节点的文本内容 - TEXT

// 差异类型的定义
let REPLACE = 0 // 替换原先的节点
let REORDER = 1 // 重新排序
let PROPS = 2 // 修改了节点的属性
let TEXT = 3 // 文本内容改变

// diffChildren为列表对比算法：
// + 抽象出来就是字符串的最小编辑距离问题
// + 最常见的解决方法是Levenshtein Distance，是1965年由苏联数学家Vladimir Levenshtein发明的
// + 通过动态规划求解，时间复杂度为O(M+N)
// 这里就不展开了
// 实际上Vue2用的是两端+key比较法，去掉了最小编辑距离算法

// 深度优先遍历DOM树
function patch(node, patches) {
    let walker = { index: 0 }
    dfsWalk(node, walker, patches)
}

function dfsWalk(node, walker, patches) {
    // 从patches拿出当前节点的差异
    let currentPatches = patches[walker.index]
    let len = node.childNodes
        ? node.childNodes.length
        : 0
    // 深度遍历子节点
    for(let i = 0; i < len; i++) {
        let child = node.chilNodes[i]
        walker.index++
        dfsWalk(child, walker, patches)
    }
    // 对当前节点进行DOM操作
    if(currentPatches) {
        applyPatches(node, currentPatches)
    }
}

// 对原有DOM树进行DOM操作
function applyPatches(node, currentPatches) {
    currentPatches.forEach(currentPatch => {
        switch(currentPatch.type) {
            case REPLACE:
                let newNode = typeof currentPatch.node === 'string'
                ? document.createTextNode(currentPatch.node)
                : currentPatch.node.render()
                node.parentNode.replaceChild(newNode, node)
                break;
            case REORDER:
                reorderChildren(node, currenPatch.moves)
                break;
            case PROPS:
                setProps(node, currentPatch.props)
                break;
            case TEXT:
                node.textContent = currentPatch.content
                break;
            default:
                throw new Error('Unknow oatch type' + currentPatch.type)
        }
    })
}