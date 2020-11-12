## From《浅谈React中的diff》：https://blog.csdn.net/sexy_squirrel/article/details/79801940

### React的diff策略

1. 忽略Web UI中DOM节点跨层级的移动
2. 拥有同类型的两个组件产生的DOM结构也是相似的，不同类型的两个组件产生的DOM结构不近相同
3. 对于同一层级的一组子节点，通过分配唯一id进行区别(key值)

基于以上三点，React对以下三个层次进行优化
+ tree diff
+ component diff
+ element diff

### 三个diff优化

#### tree diff

+ 将dom tree分层级
+ 对于两个dom tree只比较同一层次的节点
+ 忽略跨层级移动操作的dom节点：
*也就是说，如果对比发现某个父节点不存在，则直接删除该节点下的所有子节点，不会做进一步的比较*

这样优化以后，只需要对dom tree进行一次遍历就完成了两个tree的比较

*跨层级的移动操作，会直接销毁原节点及下面的子节点，重新创建一个新的节点及相应的子节点，顺序是先创建后销毁*

##### 优化点注意

保证稳定dom结构有利于提升性能，不建议频繁真正地移除或者添加节点

#### component diff

+ 同一类型组件遵从tree diff比较v-dom树
+ 不同类型组件，先将该组件归类为dirty component，替换下整个组件下的所有子节点
+ 同一类型组件Virtual Dom没有变化，React允许开发者使用shouldComponentUpdate()来判断该组件是否进行diff，运用得当可以节省diff计算时间，提升性能

##### 优化点注意

+ 对于同一类型组件合理使用shouldComponentUpdate()
+ 应该避免结构相同类型不同的组件

#### element diff

+ INSERT_MARKUP插入节点：对全新节点执行节点插入操作
+ MOVE_EXISTING移动节点：组件新集合中有组件旧集合中的类型，且element可更新，即组件调用了receiveComponent，这时可以复用之前的dom，执行dom移动操作
+ REMOVE_NODE移除节点：此时有两种情况——
  1. 组件新集合中右组件旧集合中的类型，但对应的element不可更新
  2. 旧组件不在新集合里

  这两种情况需要执行节点删除操作

+ 高效策略：允许开发者对同一层级的同组子节点添加唯一key值进行区分

##### 算法改进
（太长，略）
（就是lastIndex和旧集合节点的位置比较的方法）

##### 优化后diff的不足

比如将最后一个元素放到第一个位置时，算法会把除了最后一个元素以外的所有元素都移动一遍，这种情况就会影响渲染的性能

##### 优化建议

+ 同层级的节点添加唯一key
+ 尽量减少将最后一个节点移动到列表首部的操作