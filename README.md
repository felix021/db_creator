# db_creator
数据字典编辑器

哦，这个搭起来可能太简单了点，随便找个支持php的web服务器，塞进去就好了。

如果需要支持密码访问的话，自己改改，或者简单用HTTP Basic Authentication吧 :)

== 注 ==

编辑表格时，选择业务类型(type)，会使用业务类型配置好的值自动填充字段名称(name)、描述(note)、数据库类型(dbtype)；在保存的时候，如果note和dbtype保持不变（不包括name），它俩会被留空，下次重新载入的时候会读取该type的值。这样的好处是，当修改type的相应字段（主要是dbtype），可以反映到所有使用这个type的字段。
